import { prisma } from "../db.js";
import { startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { checkDriverConflict, checkVehicleConflict } from "./conflictService.js";
import { createAssignment, adjustDriverDutySpan } from "./assignmentService.js";
import { getTravelTime, DEPOT_LOCATION } from "./googleMapsService.js";
import { getSchedulingRules, type SchedulingRules } from "./settingsService.js";

// ── Interfaces ────────────────────────────────────────────

export interface ProposedAssignment {
  jobId: number;
  jobStartLocation?: string | null;
  jobEndLocation?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  driverId: number;
  driverName: string;
  vehicleId?: number;
  vehicleName?: string | null;
  travelFromLocation?: string;
  travelToMinutes?: number;
  travelToKm?: number;
  bufferMinutes?: number;
}

export interface SkippedJob {
  jobId: number;
  jobStartLocation?: string | null;
  reason: string;
}

export interface AutoSchedulePreview {
  preview: true;
  date: string;
  proposed: ProposedAssignment[];
  skipped: SkippedJob[];
  totalJobs: number;
  assignableCount: number;
  skippedCount: number;
}

interface DriverLoad {
  driverId: number;
  weeklyHours: number;
  weeklyEarnings: number;
}

// ── Helpers ───────────────────────────────────────────────

/**
 * Extract lat/lng from a Job for its start location.
 * Checks jobStartLat/Lng first, then falls back to booking pickupLat/Lng.
 */
function getJobStartCoords(job: any): { lat: number; lng: number } {
  if (job.jobStartLat && job.jobStartLng) {
    return { lat: job.jobStartLat, lng: job.jobStartLng };
  }
  if (job.booking?.pickupLat && job.booking?.pickupLng) {
    return { lat: job.booking.pickupLat, lng: job.booking.pickupLng };
  }
  return { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lng };
}

function getJobEndCoords(job: any): { lat: number; lng: number } {
  if (job.jobEndLat && job.jobEndLng) {
    return { lat: job.jobEndLat, lng: job.jobEndLng };
  }
  if (job.booking?.dropoffLat && job.booking?.dropoffLng) {
    return { lat: job.booking.dropoffLat, lng: job.booking.dropoffLng };
  }
  return getJobStartCoords(job);
}

/**
 * Calculates a driver's total working hours and estimated earnings for the week containing a target date.
 * Week is defined starting on Monday.
 */
export async function getDriverWeeklyLoad(driverId: number, targetDate: Date): Promise<DriverLoad> {
  const startOfTargetWeek = startOfWeek(targetDate, { weekStartsOn: 1 });
  const endOfTargetWeek = endOfWeek(targetDate, { weekStartsOn: 1 });

  const weeklyAssignments = await prisma.assignment.findMany({
    where: {
      driverId,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      scheduledStart: { gte: startOfTargetWeek, lte: endOfTargetWeek }
    },
    include: { job: true }
  });

  let weeklyHours = 0;
  let weeklyEarnings = 0;

  for (const a of weeklyAssignments) {
    const hours = a.job?.durationHours ? Number(a.job.durationHours) : 2;
    weeklyHours += hours;

    const dayOfWeek = new Date(a.scheduledStart).getDay();
    if (dayOfWeek === 0) {
      weeklyEarnings += hours * 60;
    } else if (dayOfWeek === 6) {
      weeklyEarnings += hours * 45;
    } else {
      weeklyEarnings += hours * 30;
    }
  }

  return { driverId, weeklyHours, weeklyEarnings };
}

// ── Main Auto-Schedule Engine (Nearest-Neighbor) ──────────

/**
 * Runs the automatic scheduling engine with travel-time-aware nearest-neighbor routing.
 *
 * Algorithm:
 * 1. Gather all active drivers (with depot), vehicles, and unassigned jobs
 * 2. For each driver, start at their depot
 * 3. Round-robin: each driver picks the nearest unassigned job (by travel time)
 * 4. Calculate real travel time (Google Maps / Haversine cached)
 * 5. Account for buffer time between jobs
 * 6. Check all conflict rules before assigning
 * 7. Store travel segment data on each assignment
 *
 * @param force - skip the duplicate-run guard
 */
export async function runAutoScheduling(
  startDate: Date,
  endDate: Date,
  force = false
): Promise<{ success: boolean; assignedJobsCount: number; skippedCount: number; notes?: string }> {
  const rules = await getSchedulingRules();

  // 1. Guard against duplicate runs
  if (!force) {
    const existingRun = await prisma.autoScheduleRun.findFirst({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        success: true
      }
    });
    if (existingRun) {
      return {
        success: false,
        assignedJobsCount: 0,
        skippedCount: 0,
        notes: `Automatic scheduling has already run for a period overlapping ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}.`
      };
    }
  }

  // 2. Fetch all active drivers
  const drivers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { roleName: "DRIVER" } } }
    },
    include: { homeDepot: true }
  });

  // 3. Fetch all active vehicles with assigned drivers
  const vehicles = await prisma.fleetVehicle.findMany({
    where: { status: "ACTIVE" },
    include: { homeDepot: true, assignedDriver: true }
  });

  // 4. Fetch all unassigned jobs in the date range
  const unassignedJobs = await prisma.job.findMany({
    where: {
      status: { in: ["UNASSIGNED", "OPEN", "PENDING", "Open", "pending"] },
      assignments: { none: {} },
      jobStartDateTime: { gte: startDate, lte: endDate }
    },
    include: { booking: true },
    orderBy: { jobStartDateTime: "asc" }
  });

  if (unassignedJobs.length === 0) {
    await prisma.autoScheduleRun.create({
      data: { startDate, endDate, success: true, notes: "No unassigned jobs found in this period." }
    });
    return { success: true, assignedJobsCount: 0, skippedCount: 0, notes: "No unassigned jobs found." };
  }

  // 5. Build driver state — each driver tracks their current location and time
  //    Use the configurable transit time (e.g. 60 min) as fixed gap between jobs
  const transitMinutes = rules.transitTimeMinutes;

  const driverStates: Map<number, {
    driver: any;
    currentLocation: { lat: number; lng: number };
    currentTime: Date;
    assignedCount: number;
    weeklyLoad: DriverLoad;
    vehicleId?: number;
  }> = new Map();

  // Build driver states from vehicles first (drivers with assigned vehicles)
  for (const v of vehicles) {
    if (v.assignedDriver && v.assignedDriver.isActive) {
      const depotCoords = v.homeDepot
        ? { lat: v.homeDepot.lat, lng: v.homeDepot.lng }
        : { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lng };
      const load = await getDriverWeeklyLoad(v.assignedDriver.id, startDate);

      driverStates.set(v.assignedDriver.id, {
        driver: v.assignedDriver,
        currentLocation: depotCoords,
        currentTime: startDate,
        assignedCount: 0,
        weeklyLoad: load,
        vehicleId: v.id
      });
    }
  }

  // Add remaining drivers without vehicles
  for (const driver of drivers) {
    if (!driverStates.has(driver.id)) {
      const depotCoords = driver.homeDepot
        ? { lat: driver.homeDepot.lat, lng: driver.homeDepot.lng }
        : { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lng };
      const load = await getDriverWeeklyLoad(driver.id, startDate);

      driverStates.set(driver.id, {
        driver,
        currentLocation: depotCoords,
        currentTime: startDate,
        assignedCount: 0,
        weeklyLoad: load,
      });
    }
  }

  // Track assignment counts per job for noOfVehicles support
  let assignedCount = 0;
  let skippedCount = 0;

  // Track tentative vehicle usage to avoid double-booking
  const vehicleSlots: Array<{ vehicleId: number; start: Date; end: Date }> = [];

  // Track drivers who received assignments for batch duty span recalculation
  const affectedDriverIds = new Set<number>();

  // 6. Booking-Grouped Smart Consolidation Scheduling Engine
  // Group unassigned jobs by bookingId so round-trips stay strictly bound to the same driver & vehicle
  const bookingMap = new Map<number, typeof unassignedJobs>();
  for (const job of unassignedJobs) {
    const bId = job.bookingId || job.id;
    if (!bookingMap.has(bId)) bookingMap.set(bId, []);
    bookingMap.get(bId)!.push(job);
  }

  // Sort bookings by earliest job start time
  const sortedBookingIds = [...bookingMap.keys()].sort((a, b) => {
    const jobsA = bookingMap.get(a)!;
    const jobsB = bookingMap.get(b)!;
    const startA = jobsA[0]?.jobStartDateTime ? new Date(jobsA[0].jobStartDateTime).getTime() : 0;
    const startB = jobsB[0]?.jobStartDateTime ? new Date(jobsB[0].jobStartDateTime).getTime() : 0;
    return startA - startB;
  });

  for (const bId of sortedBookingIds) {
    const bookingJobs = bookingMap.get(bId)!;
    if (bookingJobs.length === 0) continue;

    // Ensure jobs in this booking are ordered chronologically (Outbound then Return)
    bookingJobs.sort((jA: any, jB: any) => {
      const sA = jA.jobStartDateTime ? new Date(jA.jobStartDateTime).getTime() : 0;
      const sB = jB.jobStartDateTime ? new Date(jB.jobStartDateTime).getTime() : 0;
      return sA - sB;
    });

    const refBooking = bookingJobs[0]!.booking;
    const requiredVehicles = refBooking?.noOfVehicles || 1;

    for (let slot = 0; slot < requiredVehicles; slot++) {
      // Prioritize candidate drivers who ALREADY have active assignments on this date to consolidate schedules
      const candidateDriverIds = [...driverStates.keys()].sort((a, b) => {
        const stateA = driverStates.get(a)!;
        const stateB = driverStates.get(b)!;
        if (stateA.assignedCount !== stateB.assignedCount) {
          return stateB.assignedCount - stateA.assignedCount; // Active drivers first
        }
        if (stateA.weeklyLoad.weeklyEarnings !== stateB.weeklyLoad.weeklyEarnings) {
          return stateA.weeklyLoad.weeklyEarnings - stateB.weeklyLoad.weeklyEarnings;
        }
        return stateA.weeklyLoad.weeklyHours - stateB.weeklyLoad.weeklyHours;
      });

      let selectedDriverId: number | null = null;
      let selectedVehicleId: number | null = null;
      let proposedJobs: Array<{ job: any; actualStart: Date; actualEnd: Date }> = [];

      for (const driverId of candidateDriverIds) {
        const state = driverStates.get(driverId)!;
        
        let vId: number | undefined = state.vehicleId;
        const passengerCount = refBooking?.passengerCount || 0;
        if (vId) {
          const assignedV = vehicles.find((v: any) => v.id === vId);
          if (assignedV && assignedV.maxPassengers != null && passengerCount > assignedV.maxPassengers) {
            vId = undefined;
          }
        }
        if (!vId) {
          const candidateV = vehicles.find((v: any) => {
            if (v.maxPassengers != null && passengerCount > v.maxPassengers) return false;
            return true;
          });
          if (candidateV) vId = candidateV.id;
        }
        if (!vId && vehicles.length > 0) continue;

        let validForDriver = true;
        const currentProposed: typeof proposedJobs = [];
        let simTime = state.currentTime;

        for (let ji = 0; ji < bookingJobs.length; ji++) {
          const job = bookingJobs[ji]!;
          if (!job.jobStartDateTime) { validForDriver = false; break; }
          const durationHours = job.durationHours ? Number(job.durationHours) : 2;
          const originalStart = new Date(job.jobStartDateTime);

          let actualStart: Date;
          if (ji === 0) {
            // First job in booking: apply transit time from previous booking/depot
            const earliestArrival = new Date(simTime.getTime() + transitMinutes * 60000);
            actualStart = earliestArrival > originalStart ? earliestArrival : originalStart;
          } else {
            // Subsequent jobs in same booking (e.g. return leg): use original scheduled time
            // The driver is already at the location, no transit needed
            actualStart = originalStart > simTime ? originalStart : simTime;
          }
          const actualEnd = new Date(actualStart.getTime() + durationHours * 3600000);

          const dConflict = await checkDriverConflict(driverId, actualStart, actualEnd, undefined, job.id, rules);
          if (dConflict.hasConflict) { validForDriver = false; break; }

          if (vId) {
            const vBooked = vehicleSlots.some((s) => s.vehicleId === vId && s.start < actualEnd && s.end > actualStart);
            if (vBooked) { validForDriver = false; break; }
            const vConflict = await checkVehicleConflict(vId, actualStart, actualEnd);
            if (vConflict.hasConflict) { validForDriver = false; break; }
          }

          currentProposed.push({ job, actualStart, actualEnd });
          simTime = actualEnd;
        }

        if (validForDriver && currentProposed.length === bookingJobs.length) {
          selectedDriverId = driverId;
          selectedVehicleId = vId || null;
          proposedJobs = currentProposed;
          break;
        }
      }

      if (selectedDriverId && proposedJobs.length > 0) {
        const state = driverStates.get(selectedDriverId)!;
        for (const pj of proposedJobs) {
          await createAssignment({
            jobId: pj.job.id,
            driverId: selectedDriverId,
            vehicleId: selectedVehicleId || undefined,
            scheduledStart: pj.actualStart.toISOString(),
            scheduledEnd: pj.actualEnd.toISOString(),
            travelFromLocation: `${state.currentLocation.lat},${state.currentLocation.lng}`,
            travelToMinutes: transitMinutes,
            travelToKm: 0,
            bufferMinutes: rules.bufferMinutes,
          });

          if (selectedVehicleId) {
            vehicleSlots.push({ vehicleId: selectedVehicleId, start: pj.actualStart, end: pj.actualEnd });
          }
          const endCoords = getJobEndCoords(pj.job);
          if (endCoords) state.currentLocation = endCoords;
          state.currentTime = pj.actualEnd;
          state.assignedCount++;
          state.weeklyLoad.weeklyHours += pj.job.durationHours ? Number(pj.job.durationHours) : 2;
          assignedCount++;
        }
        // Track this driver for batch duty span recalculation
        affectedDriverIds.add(selectedDriverId);
      }
    }
  }

  // 7. Batch duty span recalculation for ALL affected drivers
  //    This ensures every driver who received assignments gets a correct duty span,
  //    since all their assignments are now visible in the database.
  for (const driverId of affectedDriverIds) {
    try {
      await adjustDriverDutySpan(prisma, driverId, startDate);
    } catch (e) {
      console.error(`Failed to recalculate duty span for driver ${driverId}:`, e);
    }
  }

  // Count skipped (unassigned jobs that weren't assigned)
  skippedCount = unassignedJobs.length - assignedCount;

  // 8. Record the automatic schedule run log (upsert to handle re-runs)
  await prisma.autoScheduleRun.upsert({
    where: {
      startDate_endDate: {
        startDate,
        endDate
      }
    },
    update: {
      runDate: new Date(),
      success: true,
      notes: `Successfully scheduled ${assignedCount} of ${unassignedJobs.length} jobs (${skippedCount} skipped).`
    },
    create: {
      startDate,
      endDate,
      success: true,
      notes: `Successfully scheduled ${assignedCount} of ${unassignedJobs.length} jobs (${skippedCount} skipped).`
    }
  });

  return { success: true, assignedJobsCount: assignedCount, skippedCount };
}

// ── Preview (Dry-Run) ─────────────────────────────────────

/**
 * DRY-RUN version of auto-scheduling using fixed transit time.
 * Makes NO database writes. Returns a preview of what would be assigned.
 */
export async function previewAutoScheduling(
  startDate: Date,
  endDate: Date
): Promise<AutoSchedulePreview> {
  const rules = await getSchedulingRules();
  const transitMinutes = rules.transitTimeMinutes;

  const drivers = await prisma.user.findMany({
    where: { isActive: true, roles: { some: { role: { roleName: "DRIVER" } } } },
    include: { homeDepot: true },
  });

  const vehicles = await prisma.fleetVehicle.findMany({ 
    where: { status: "ACTIVE" },
    include: { homeDepot: true, assignedDriver: true }
  });

  const unassignedJobs = await prisma.job.findMany({
    where: {
      status: { in: ["UNASSIGNED", "OPEN", "PENDING", "Open", "pending"] },
      assignments: { none: {} },
      jobStartDateTime: { gte: startDate, lte: endDate },
    },
    include: { booking: true },
    orderBy: { jobStartDateTime: "asc" },
  });

  const proposed: ProposedAssignment[] = [];
  const skipped: SkippedJob[] = [];

  // Build driver state for preview
  const driverStates: Map<number, {
    driver: any;
    currentLocation: { lat: number; lng: number };
    currentTime: Date;
    assignedCount: number;
    vehicleId?: number;
  }> = new Map();

  for (const v of vehicles) {
    if (v.assignedDriver && v.assignedDriver.isActive) {
      const depotCoords = v.homeDepot
        ? { lat: v.homeDepot.lat, lng: v.homeDepot.lng }
        : { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lng };

      driverStates.set(v.assignedDriver.id, {
        driver: v.assignedDriver,
        currentLocation: depotCoords,
        currentTime: startDate,
        assignedCount: 0,
        vehicleId: v.id
      });
    }
  }

  for (const driver of drivers) {
    if (!driverStates.has(driver.id)) {
      const depotCoords = driver.homeDepot
        ? { lat: driver.homeDepot.lat, lng: driver.homeDepot.lng }
        : { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lng };

      driverStates.set(driver.id, {
        driver,
        currentLocation: depotCoords,
        currentTime: startDate,
        assignedCount: 0,
      });
    }
  }

  const assignedJobIds = new Set<number>();
  const vehicleSlots: Array<{ vehicleId: number; start: Date; end: Date }> = [];
  const tentativeDriverSlots: Array<{ driverId: number; start: Date; end: Date }> = [];

  // Group jobs by booking for consolidated scheduling
  const bookingMap = new Map<number, typeof unassignedJobs>();
  for (const job of unassignedJobs) {
    const bId = job.bookingId || job.id;
    if (!bookingMap.has(bId)) bookingMap.set(bId, []);
    bookingMap.get(bId)!.push(job);
  }

  // Sort bookings by earliest job start time
  const sortedBookingIds = [...bookingMap.keys()].sort((a, b) => {
    const jobsA = bookingMap.get(a)!;
    const jobsB = bookingMap.get(b)!;
    const startA = jobsA[0]?.jobStartDateTime ? new Date(jobsA[0].jobStartDateTime).getTime() : 0;
    const startB = jobsB[0]?.jobStartDateTime ? new Date(jobsB[0].jobStartDateTime).getTime() : 0;
    return startA - startB;
  });

  for (const bId of sortedBookingIds) {
    const bookingJobs = bookingMap.get(bId)!;
    if (bookingJobs.length === 0) continue;

    // Sort jobs in booking chronologically
    bookingJobs.sort((jA: any, jB: any) => {
      const sA = jA.jobStartDateTime ? new Date(jA.jobStartDateTime).getTime() : 0;
      const sB = jB.jobStartDateTime ? new Date(jB.jobStartDateTime).getTime() : 0;
      return sA - sB;
    });

    const refBooking = bookingJobs[0]!.booking;
    const requiredVehicles = refBooking?.noOfVehicles || 1;

    for (let slot = 0; slot < requiredVehicles; slot++) {
      // Sort drivers: active drivers first, then by weekly earnings/hours
      const candidateDriverIds = [...driverStates.keys()].sort((a, b) => {
        const stateA = driverStates.get(a)!;
        const stateB = driverStates.get(b)!;
        if (stateA.assignedCount !== stateB.assignedCount) {
          return stateB.assignedCount - stateA.assignedCount;
        }
        return 0;
      });

      let assigned = false;

      for (const driverId of candidateDriverIds) {
        const state = driverStates.get(driverId)!;

        let vId: number | undefined = state.vehicleId;
        const passengerCount = refBooking?.passengerCount || 0;
        if (vId) {
          const assignedV = vehicles.find((v: any) => v.id === vId);
          if (assignedV && assignedV.maxPassengers != null && passengerCount > assignedV.maxPassengers) {
            vId = undefined;
          }
        }
        if (!vId) {
          const candidateV = vehicles.find((v: any) => {
            if (v.maxPassengers != null && passengerCount > v.maxPassengers) return false;
            const isBooked = vehicleSlots.some(
              (s) => s.vehicleId === v.id && bookingJobs.some((j: any) => {
                if (!j.jobStartDateTime) return false;
                const jStart = new Date(j.jobStartDateTime);
                const dur = j.durationHours ? Number(j.durationHours) : 2;
                const jEnd = new Date(jStart.getTime() + dur * 3600000);
                return s.start < jEnd && s.end > jStart;
              })
            );
            return !isBooked;
          });
          if (candidateV) vId = candidateV.id;
        }
        if (!vId && vehicles.length > 0) continue;

        // Find the vehicle object for display
        const selectedVehicle = vId ? vehicles.find((v: any) => v.id === vId) : undefined;

        let validForDriver = true;
        const currentProposed: Array<{ job: any; actualStart: Date; actualEnd: Date }> = [];
        let simTime = state.currentTime;

        for (let ji = 0; ji < bookingJobs.length; ji++) {
          const job = bookingJobs[ji]!;
          if (!job.jobStartDateTime) { validForDriver = false; break; }
          const durationHours = job.durationHours ? Number(job.durationHours) : 2;
          const originalStart = new Date(job.jobStartDateTime);

          let actualStart: Date;
          if (ji === 0) {
            // First job in booking: apply transit time from previous booking/depot
            const earliestArrival = new Date(simTime.getTime() + transitMinutes * 60000);
            actualStart = earliestArrival > originalStart ? earliestArrival : originalStart;
          } else {
            // Subsequent jobs in same booking (e.g. return leg): use original scheduled time
            actualStart = originalStart > simTime ? originalStart : simTime;
          }
          const actualEnd = new Date(actualStart.getTime() + durationHours * 3600000);

          // Check tentative driver overlap
          const hasTentativeConflict = tentativeDriverSlots.some(
            (t) => t.driverId === driverId && t.start < actualEnd && t.end > actualStart
          );
          if (hasTentativeConflict) { validForDriver = false; break; }

          // Check real conflicts
          try {
            const conflict = await checkDriverConflict(driverId, actualStart, actualEnd, undefined, job.id, rules);
            if (conflict.hasConflict) { validForDriver = false; break; }
          } catch (_) { validForDriver = false; break; }

          // Check vehicle
          if (vId) {
            const isBooked = vehicleSlots.some(
              (s) => s.vehicleId === vId && s.start < actualEnd && s.end > actualStart
            );
            if (isBooked) { validForDriver = false; break; }
          }

          currentProposed.push({ job, actualStart, actualEnd });
          simTime = actualEnd;
        }

        if (validForDriver && currentProposed.length === bookingJobs.length) {
          // Record all proposed assignments
          for (const pj of currentProposed) {
            const travelFromLocation = state.assignedCount === 0
              ? "depot"
              : `${state.currentLocation.lat},${state.currentLocation.lng}`;

            tentativeDriverSlots.push({ driverId, start: pj.actualStart, end: pj.actualEnd });
            if (selectedVehicle) {
              vehicleSlots.push({ vehicleId: selectedVehicle.id, start: pj.actualStart, end: pj.actualEnd });
            }

            proposed.push({
              jobId: pj.job.id,
              jobStartLocation: pj.job.jobStartLocation,
              jobEndLocation: pj.job.jobEndLocation,
              scheduledStart: pj.actualStart.toISOString(),
              scheduledEnd: pj.actualEnd.toISOString(),
              driverId,
              driverName: state.driver.name || `Driver #${driverId}`,
              vehicleId: selectedVehicle?.id,
              vehicleName: selectedVehicle?.licensePlate ?? null,
              travelFromLocation,
              travelToMinutes: transitMinutes,
              travelToKm: 0,
              bufferMinutes: rules.bufferMinutes,
            });

            const jobEndCoords = getJobEndCoords(pj.job);
            if (jobEndCoords) state.currentLocation = jobEndCoords;
            state.currentTime = pj.actualEnd;
            state.assignedCount++;
            assignedJobIds.add(pj.job.id);
          }
          assigned = true;
          break;
        }
      }
    }
  }

  // Mark remaining jobs as skipped
  for (const job of unassignedJobs) {
    if (!assignedJobIds.has(job.id)) {
      skipped.push({
        jobId: job.id,
        jobStartLocation: job.jobStartLocation,
        reason: "No eligible drivers without conflict",
      });
    }
  }

  return {
    preview: true,
    date: startDate.toISOString().split("T")[0]!,
    proposed,
    skipped,
    totalJobs: unassignedJobs.length,
    assignableCount: proposed.length,
    skippedCount: skipped.length,
  };
}
