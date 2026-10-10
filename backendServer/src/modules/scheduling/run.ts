import { prisma } from "../../db.js";
import { createAssignment } from "../../services/assignmentService.js";
import { localDate } from "../../services/businessTime.js";
import { checkDriverConflict, checkVehicleConflict } from "../../services/conflictService.js";
import { getTravelTime, jobPoint, vehicleDepot } from "../../services/googleMapsService.js";
import { getSchedulingRules } from "../../services/settingsService.js";
import type { DriverLoad } from "./types.js";
import { getDriverWeeklyLoad } from "./weekly-load.js";
function getJobStartCoords(job: any) {
  return jobPoint(job);
}
function getJobEndCoords(job: any) {
  return jobPoint(job, true);
}
export async function runAutoScheduling(
  startDate: Date,
  endDate: Date,
  force = false,
): Promise<{ success: boolean; assignedJobsCount: number; skippedCount: number; notes?: string }> {
  const rules = await getSchedulingRules();
  const skippedReasons = new Map<number, string>();

  // 1. Guard against duplicate runs
  if (!force) {
    const existingRun = await prisma.autoScheduleRun.findFirst({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        success: true,
      },
    });
    if (existingRun) {
      return {
        success: false,
        assignedJobsCount: 0,
        skippedCount: 0,
        notes: `Automatic scheduling has already run for a period overlapping ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}.`,
      };
    }
  }

  // 2. Fetch all active drivers
  const drivers = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: "DRIVER",
    },
  });

  // 3. Fetch all active vehicles with assigned drivers
  const vehicles = await prisma.fleetVehicle.findMany({
    where: { status: "ACTIVE" },
    include: { homeDepot: true, assignedDriver: true },
  });

  // 4. Fetch all unassigned jobs in the date range
  const unassignedJobs = await prisma.job
    .findMany({
      where: {
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        yardManaged: false,
        booking: { status: "CONFIRMED" },
        jobStartDateTime: { gte: startDate, lt: endDate },
      },
      include: { booking: true, assignments: { where: { status: { not: "CANCELLED" } } } },
      orderBy: { jobStartDateTime: "asc" },
    })
    .then((jobs: any[]) =>
      jobs.filter((j) => j.assignments.length < (j.booking?.noOfVehicles || 1)),
    );

  if (unassignedJobs.length === 0) {
    await prisma.autoScheduleRun.upsert({
      where: { startDate_endDate: { startDate, endDate } },
      create: { startDate, endDate, success: true },
      update: { success: true },
    });
    return {
      success: true,
      assignedJobsCount: 0,
      skippedCount: 0,
      notes: "No unassigned jobs found.",
    };
  }

  // 5. Build driver state tracking
  const driverStates: Map<
    number,
    {
      driver: any;
      assignedCount: number;
      weeklyLoad: DriverLoad;
      vehicleId?: number;
    }
  > = new Map();

  for (const v of vehicles) {
    if (v.assignedDriver && v.assignedDriver.status === "ACTIVE") {
      const load = await getDriverWeeklyLoad(v.assignedDriver.id, startDate);
      driverStates.set(v.assignedDriver.id, {
        driver: v.assignedDriver,
        assignedCount: 0,
        weeklyLoad: load,
        vehicleId: v.id,
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
    let bookingJobs = bookingMap.get(bId)!;
    if (bookingJobs.length === 0) continue;

    bookingJobs.sort((jA: any, jB: any) => {
      const sA = jA.jobStartDateTime ? new Date(jA.jobStartDateTime).getTime() : 0;
      const sB = jB.jobStartDateTime ? new Date(jB.jobStartDateTime).getTime() : 0;
      return sA - sB;
    });

    const refBooking = bookingJobs[0]!.booking;
    const requiredVehicles = refBooking?.noOfVehicles || 1;

    const allBookingJobs = bookingJobs;
    for (let slot = 0; slot < requiredVehicles; slot++) {
      bookingJobs = allBookingJobs.filter((j: any) => (j.assignments?.length || 0) <= slot);
      if (!bookingJobs.length) continue;
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
      let proposedJobs: Array<{
        job: any;
        actualStart: Date;
        actualEnd: Date;
        travelToMins: number;
      }> = [];

      for (const driverId of candidateDriverIds) {
        const state = driverStates.get(driverId)!;

        let vId: number | undefined = state.vehicleId;
        const passengerCount = Math.ceil((refBooking?.passengerCount || 0) / requiredVehicles);
        if (vId) {
          const assignedV = vehicles.find((v: any) => v.id === vId);
          if (assignedV && (!assignedV.maxPassengers || passengerCount > assignedV.maxPassengers)) {
            vId = undefined;
          }
        }
        if (!vId) {
          const candidateV = vehicles.find((v: any) => {
            if (!v.maxPassengers || passengerCount > v.maxPassengers) return false;
            return true;
          });
          if (candidateV) vId = candidateV.id;
        }
        if (!vId) continue;

        let validForDriver = true;
        const currentProposed: typeof proposedJobs = [];

        for (let ji = 0; ji < bookingJobs.length; ji++) {
          const job = bookingJobs[ji]!;
          if (!job.jobStartDateTime) {
            validForDriver = false;
            break;
          }
          const durationHours = job.durationHours ? Number(job.durationHours) : 2;
          const actualStart = new Date(job.jobStartDateTime);
          const actualEnd = new Date(
            job.jobEndDateTime || actualStart.getTime() + durationHours * 3600000,
          );

          // 1. Check in-memory tentative driver overlap
          const driverOverlap = tentativeDriverSlots.some(
            (t) => t.driverId === driverId && t.start < actualEnd && t.end > actualStart,
          );
          if (driverOverlap) {
            validForDriver = false;
            break;
          }

          // 2. Check in-memory vehicle overlap
          if (vId) {
            const vBooked = vehicleSlots.some(
              (s) => s.vehicleId === vId && s.start < actualEnd && s.end > actualStart,
            );
            if (vBooked) {
              validForDriver = false;
              break;
            }
            const vConflict = await checkVehicleConflict(vId, actualStart, actualEnd);
            if (vConflict.hasConflict) {
              validForDriver = false;
              break;
            }
          }

          // 3. Check travel time from previous job or vehicle depot
          let depot: any, jobStartCoords: { lat: number; lng: number };
          try {
            depot = await vehicleDepot(vId);
            jobStartCoords = getJobStartCoords(job);
          } catch (error: any) {
            skippedReasons.set(job.id, error.message || "Route review required");
            validForDriver = false;
            break;
          }
          let prevLocation: { lat: number; lng: number } | string = {
            lat: depot.lat,
            lng: depot.lng,
          };
          let prevEndTime: Date | null = null;

          // Find driver's latest previous assignment on the same day
          const dayTentatives = tentativeDriverSlots
            .filter(
              (t) =>
                t.driverId === driverId &&
                localDate(t.start) === localDate(actualStart) &&
                t.end <= actualStart,
            )
            .sort((a, b) => b.end.getTime() - a.end.getTime());

          if (dayTentatives.length > 0) {
            const lastTentative = dayTentatives[0]!;
            prevEndTime = lastTentative.end;
            const lastJob = currentProposed.find(
              (p) => p.actualEnd.getTime() === lastTentative.end.getTime(),
            )?.job;
            if (lastJob) {
              prevLocation = getJobEndCoords(lastJob);
            }
          }

          let travel;
          try {
            travel = await getTravelTime(prevLocation, jobStartCoords, {
              vehicleId: vId!,
              at: prevEndTime || actualStart,
              timing: prevEndTime ? "DEPART_AT" : "ARRIVE_BY",
            });
          } catch (error: any) {
            skippedReasons.set(job.id, error.message || "Route review required");
            validForDriver = false;
            break;
          }
          const requiredBufferMins = travel.durationMinutes + (prevEndTime ? 0 : 10); // 10m depot buffer if first trip

          if (prevEndTime) {
            const gapMins = (actualStart.getTime() - prevEndTime.getTime()) / 60000;
            if (gapMins < requiredBufferMins) {
              validForDriver = false;
              break;
            }
          }

          // 4. Check DB conflicts
          let dConflict;
          try {
            dConflict = await checkDriverConflict(
              driverId,
              actualStart,
              actualEnd,
              undefined,
              job.id,
              rules,
              prisma,
              vId!,
            );
          } catch (error: any) {
            skippedReasons.set(job.id, error.message || "Route review required");
            validForDriver = false;
            break;
          }
          if (dConflict.hasConflict) {
            validForDriver = false;
            break;
          }

          currentProposed.push({
            job,
            actualStart,
            actualEnd,
            travelToMins: travel.durationMinutes,
          });
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
          try {
            await createAssignment({
              jobId: pj.job.id,
              driverId: selectedDriverId,
              vehicleId: selectedVehicleId || undefined,
              scheduledStart: pj.actualStart.toISOString(),
              scheduledEnd: pj.actualEnd.toISOString(),
              travelFromLocation: "Reviewed positioning route",
              travelToMinutes: pj.travelToMins,

              bufferMinutes: rules.bufferMinutes,
            });
          } catch (error: any) {
            skippedReasons.set(pj.job.id, error.message || "Route review required");
            skippedCount++;
            continue;
          }

          tentativeDriverSlots.push({
            driverId: selectedDriverId,
            start: pj.actualStart,
            end: pj.actualEnd,
          });
          if (selectedVehicleId) {
            vehicleSlots.push({
              vehicleId: selectedVehicleId,
              start: pj.actualStart,
              end: pj.actualEnd,
            });
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

  // Each successful createAssignment updates duty and positioning atomically.
  skippedCount = Math.max(
    skippedCount,
    unassignedJobs.reduce(
      (n: number, j: any) =>
        n + Math.max(0, (j.booking?.noOfVehicles || 1) - (j.assignments?.length || 0)),
      0,
    ) - assignedCount,
  );

  // 8. Record the automatic schedule run log
  await prisma.autoScheduleRun.upsert({
    where: {
      startDate_endDate: {
        startDate,
        endDate,
      },
    },
    update: {
      runDate: new Date(),
      success: true,
      notes: `Successfully scheduled ${assignedCount} of ${unassignedJobs.length} jobs (${skippedCount} skipped).`,
    },
    create: {
      startDate,
      endDate,
      success: true,
      notes: `Successfully scheduled ${assignedCount} of ${unassignedJobs.length} jobs (${skippedCount} skipped).`,
    },
  });

  return {
    success: true,
    assignedJobsCount: assignedCount,
    skippedCount,
    notes: [...skippedReasons].map(([id, reason]) => `Job #${id}: ${reason}`).join("; "),
  };
}
