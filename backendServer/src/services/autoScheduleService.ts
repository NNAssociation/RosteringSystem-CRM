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

  // 5. Build driver state tracking
  const driverStates: Map<number, {
    driver: any;
    assignedCount: number;
    weeklyLoad: DriverLoad;
    vehicleId?: number;
  }> = new Map();

  for (const v of vehicles) {
    if (v.assignedDriver && v.assignedDriver.isActive) {
      const load = await getDriverWeeklyLoad(v.assignedDriver.id, startDate);
      driverStates.set(v.assignedDriver.id, {
        driver: v.assignedDriver,
        assignedCount: 0,
        weeklyLoad: load,
        vehicleId: v.id
      });
    }
  }

  for (const driver of drivers) {
    if (!driverStates.has(driver.id)) {
      const load = await getDriverWeeklyLoad(driver.id, startDate);
      driverStates.set(driver.id, {
        driver,
        assignedCount: 0,
        weeklyLoad: load,
      });
    }
  }

  let assignedCount = 0;
  let skippedCount = 0;

  // Track in-memory tentative vehicle & driver slots to avoid overlaps across batch bookings
  const vehicleSlots: Array<{ vehicleId: number; start: Date; end: Date }> = [];
  const tentativeDriverSlots: Array<{ driverId: number; start: Date; end: Date }> = [];

  // Map of driverId -> Set of yyyy-MM-dd date strings requiring duty span calculation
  const affectedDriverDates = new Map<number, Set<string>>();

  // 6. Booking-Grouped Consolidation Scheduling Engine
  const bookingMap = new Map<number, typeof unassignedJobs>();
  for (const job of unassignedJobs) {
    const bId = job.bookingId || job.id;
    if (!bookingMap.has(bId)) bookingMap.set(bId, []);
    bookingMap.get(bId)!.push(job);
  }

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

    bookingJobs.sort((jA: any, jB: any) => {
      const sA = jA.jobStartDateTime ? new Date(jA.jobStartDateTime).getTime() : 0;
      const sB = jB.jobStartDateTime ? new Date(jB.jobStartDateTime).getTime() : 0;
      return sA - sB;
    });

    const refBooking = bookingJobs[0]!.booking;
    const requiredVehicles = refBooking?.noOfVehicles || 1;

    for (let slot = 0; slot < requiredVehicles; slot++) {
      const firstJobStart = new Date(bookingJobs[0]!.jobStartDateTime);
      const isWeekend = firstJobStart.getDay() === 0 || firstJobStart.getDay() === 6;

      // Requirement 4: Fair Workload & Weekend Earnings Distribution
      const candidateDriverIds = [...driverStates.keys()].sort((a, b) => {
        const stateA = driverStates.get(a)!;
        const stateB = driverStates.get(b)!;
        if (isWeekend) {
          if (stateA.weeklyLoad.weeklyEarnings !== stateB.weeklyLoad.weeklyEarnings) {
            return stateA.weeklyLoad.weeklyEarnings - stateB.weeklyLoad.weeklyEarnings;
          }
          return stateA.weeklyLoad.weeklyHours - stateB.weeklyLoad.weeklyHours;
        } else {
          if (stateA.weeklyLoad.weeklyHours !== stateB.weeklyLoad.weeklyHours) {
            return stateA.weeklyLoad.weeklyHours - stateB.weeklyLoad.weeklyHours;
          }
          return stateA.weeklyLoad.weeklyEarnings - stateB.weeklyLoad.weeklyEarnings;
        }
      });

      let selectedDriverId: number | null = null;
      let selectedVehicleId: number | null = null;
      let proposedJobs: Array<{ job: any; actualStart: Date; actualEnd: Date; travelToMins: number }> = [];

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

        for (let ji = 0; ji < bookingJobs.length; ji++) {
          const job = bookingJobs[ji]!;
          if (!job.jobStartDateTime) { validForDriver = false; break; }
          const durationHours = job.durationHours ? Number(job.durationHours) : 2;
          const actualStart = new Date(job.jobStartDateTime);
          const actualEnd = new Date(actualStart.getTime() + durationHours * 3600000);

          // 1. Check in-memory tentative driver overlap
          const driverOverlap = tentativeDriverSlots.some(
            (t) => t.driverId === driverId && t.start < actualEnd && t.end > actualStart
          );
          if (driverOverlap) { validForDriver = false; break; }

          // 2. Check in-memory vehicle overlap
          if (vId) {
            const vBooked = vehicleSlots.some((s) => s.vehicleId === vId && s.start < actualEnd && s.end > actualStart);
            if (vBooked) { validForDriver = false; break; }
            const vConflict = await checkVehicleConflict(vId, actualStart, actualEnd);
            if (vConflict.hasConflict) { validForDriver = false; break; }
          }

          // 3. Check travel time from previous job or Punchbowl depot
          const jobStartCoords = getJobStartCoords(job);
          let prevLocation: { lat: number; lng: number } | string = { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lng };
          let prevEndTime: Date | null = null;

          // Find driver's latest previous assignment on the same day
          const dayTentatives = tentativeDriverSlots
            .filter(t => t.driverId === driverId && startOfDay(t.start).getTime() === startOfDay(actualStart).getTime() && t.end <= actualStart)
            .sort((a, b) => b.end.getTime() - a.end.getTime());

          if (dayTentatives.length > 0) {
            const lastTentative = dayTentatives[0]!;
            prevEndTime = lastTentative.end;
            const lastJob = currentProposed.find(p => p.actualEnd.getTime() === lastTentative.end.getTime())?.job;
            if (lastJob) {
              prevLocation = getJobEndCoords(lastJob);
            }
          }

          const travel = await getTravelTime(prevLocation, jobStartCoords);
          const requiredBufferMins = travel.durationMinutes + (prevEndTime ? 0 : 10); // 10m depot buffer if first trip

          if (prevEndTime) {
            const gapMins = (actualStart.getTime() - prevEndTime.getTime()) / 60000;
            if (gapMins < requiredBufferMins) {
              validForDriver = false;
              break;
            }
          }

          // 4. Check DB conflicts
          const dConflict = await checkDriverConflict(driverId, actualStart, actualEnd, undefined, job.id, rules);
          if (dConflict.hasConflict) { validForDriver = false; break; }

          currentProposed.push({ job, actualStart, actualEnd, travelToMins: travel.durationMinutes });
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
            travelFromLocation: DEPOT_LOCATION.name,
            travelToMinutes: pj.travelToMins,
            travelToKm: 0,
            bufferMinutes: rules.bufferMinutes,
          });

          tentativeDriverSlots.push({ driverId: selectedDriverId, start: pj.actualStart, end: pj.actualEnd });
          if (selectedVehicleId) {
            vehicleSlots.push({ vehicleId: selectedVehicleId, start: pj.actualStart, end: pj.actualEnd });
          }

          state.assignedCount++;
          const duration = pj.job.durationHours ? Number(pj.job.durationHours) : 2;
          state.weeklyLoad.weeklyHours += duration;
          const day = pj.actualStart.getDay();
          const rate = day === 0 ? 60 : day === 6 ? 45 : 30;
          state.weeklyLoad.weeklyEarnings += duration * rate;
          assignedCount++;

          // Record affected date for duty span recalculation
          const dateStr = pj.actualStart.toISOString().split("T")[0]!;
          if (!affectedDriverDates.has(selectedDriverId)) {
            affectedDriverDates.set(selectedDriverId, new Set());
          }
          affectedDriverDates.get(selectedDriverId)!.add(dateStr);
        }
      }
    }
  }

  // 7. Batch duty span recalculation for ALL affected drivers and dates
  for (const [driverId, datesSet] of affectedDriverDates.entries()) {
    for (const dateStr of datesSet) {
      try {
        await adjustDriverDutySpan(prisma, driverId, new Date(dateStr));
      } catch (e) {
        console.error(`Failed to recalculate duty span for driver ${driverId} on ${dateStr}:`, e);
      }
    }
  }

  skippedCount = unassignedJobs.length - assignedCount;

  // 8. Record the automatic schedule run log
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

  const driverStates: Map<number, {
    driver: any;
    assignedCount: number;
    weeklyLoad: DriverLoad;
    vehicleId?: number;
  }> = new Map();

  for (const v of vehicles) {
    if (v.assignedDriver && v.assignedDriver.isActive) {
      const load = await getDriverWeeklyLoad(v.assignedDriver.id, startDate);
      driverStates.set(v.assignedDriver.id, {
        driver: v.assignedDriver,
        assignedCount: 0,
        weeklyLoad: load,
        vehicleId: v.id
      });
    }
  }

  for (const driver of drivers) {
    if (!driverStates.has(driver.id)) {
      const load = await getDriverWeeklyLoad(driver.id, startDate);
      driverStates.set(driver.id, {
        driver,
        assignedCount: 0,
        weeklyLoad: load,
      });
    }
  }

  const assignedJobIds = new Set<number>();
  const vehicleSlots: Array<{ vehicleId: number; start: Date; end: Date }> = [];
  const tentativeDriverSlots: Array<{ driverId: number; start: Date; end: Date }> = [];

  const bookingMap = new Map<number, typeof unassignedJobs>();
  for (const job of unassignedJobs) {
    const bId = job.bookingId || job.id;
    if (!bookingMap.has(bId)) bookingMap.set(bId, []);
    bookingMap.get(bId)!.push(job);
  }

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

    bookingJobs.sort((jA: any, jB: any) => {
      const sA = jA.jobStartDateTime ? new Date(jA.jobStartDateTime).getTime() : 0;
      const sB = jB.jobStartDateTime ? new Date(jB.jobStartDateTime).getTime() : 0;
      return sA - sB;
    });

    const refBooking = bookingJobs[0]!.booking;
    const requiredVehicles = refBooking?.noOfVehicles || 1;

    for (let slot = 0; slot < requiredVehicles; slot++) {
      const firstJobStart = new Date(bookingJobs[0]!.jobStartDateTime);
      const isWeekend = firstJobStart.getDay() === 0 || firstJobStart.getDay() === 6;

      const candidateDriverIds = [...driverStates.keys()].sort((a, b) => {
        const stateA = driverStates.get(a)!;
        const stateB = driverStates.get(b)!;
        if (isWeekend) {
          if (stateA.weeklyLoad.weeklyEarnings !== stateB.weeklyLoad.weeklyEarnings) {
            return stateA.weeklyLoad.weeklyEarnings - stateB.weeklyLoad.weeklyEarnings;
          }
          return stateA.weeklyLoad.weeklyHours - stateB.weeklyLoad.weeklyHours;
        } else {
          if (stateA.weeklyLoad.weeklyHours !== stateB.weeklyLoad.weeklyHours) {
            return stateA.weeklyLoad.weeklyHours - stateB.weeklyLoad.weeklyHours;
          }
          return stateA.weeklyLoad.weeklyEarnings - stateB.weeklyLoad.weeklyEarnings;
        }
      });

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

        const selectedVehicle = vId ? vehicles.find((v: any) => v.id === vId) : undefined;
        let validForDriver = true;
        const currentProposed: Array<{ job: any; actualStart: Date; actualEnd: Date; travelToMins: number }> = [];

        for (let ji = 0; ji < bookingJobs.length; ji++) {
          const job = bookingJobs[ji]!;
          if (!job.jobStartDateTime) { validForDriver = false; break; }
          const durationHours = job.durationHours ? Number(job.durationHours) : 2;
          const actualStart = new Date(job.jobStartDateTime);
          const actualEnd = new Date(actualStart.getTime() + durationHours * 3600000);

          const hasTentativeConflict = tentativeDriverSlots.some(
            (t) => t.driverId === driverId && t.start < actualEnd && t.end > actualStart
          );
          if (hasTentativeConflict) { validForDriver = false; break; }

          if (vId) {
            const isBooked = vehicleSlots.some(
              (s) => s.vehicleId === vId && s.start < actualEnd && s.end > actualStart
            );
            if (isBooked) { validForDriver = false; break; }
          }

          const jobStartCoords = getJobStartCoords(job);
          let prevLocation: { lat: number; lng: number } | string = { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lng };
          let prevEndTime: Date | null = null;

          const dayTentatives = tentativeDriverSlots
            .filter(t => t.driverId === driverId && startOfDay(t.start).getTime() === startOfDay(actualStart).getTime() && t.end <= actualStart)
            .sort((a, b) => b.end.getTime() - a.end.getTime());

          if (dayTentatives.length > 0) {
            const lastTentative = dayTentatives[0]!;
            prevEndTime = lastTentative.end;
            const lastJob = currentProposed.find(p => p.actualEnd.getTime() === lastTentative.end.getTime())?.job;
            if (lastJob) {
              prevLocation = getJobEndCoords(lastJob);
            }
          }

          const travel = await getTravelTime(prevLocation, jobStartCoords);
          const requiredBufferMins = travel.durationMinutes + (prevEndTime ? 0 : 10);

          if (prevEndTime) {
            const gapMins = (actualStart.getTime() - prevEndTime.getTime()) / 60000;
            if (gapMins < requiredBufferMins) {
              validForDriver = false;
              break;
            }
          }

          try {
            const conflict = await checkDriverConflict(driverId, actualStart, actualEnd, undefined, job.id, rules);
            if (conflict.hasConflict) { validForDriver = false; break; }
          } catch (_) { validForDriver = false; break; }

          currentProposed.push({ job, actualStart, actualEnd, travelToMins: travel.durationMinutes });
        }

        if (validForDriver && currentProposed.length === bookingJobs.length) {
          for (const pj of currentProposed) {
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
              travelFromLocation: DEPOT_LOCATION.name,
              travelToMinutes: pj.travelToMins,
              travelToKm: 0,
              bufferMinutes: rules.bufferMinutes,
            });

            state.assignedCount++;
            const duration = pj.job.durationHours ? Number(pj.job.durationHours) : 2;
            state.weeklyLoad.weeklyHours += duration;
            const day = pj.actualStart.getDay();
            const rate = day === 0 ? 60 : day === 6 ? 45 : 30;
            state.weeklyLoad.weeklyEarnings += duration * rate;
            assignedJobIds.add(pj.job.id);
          }
          break;
        }
      }
    }
  }

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
