import { prisma } from "../../db.js";
import { localDate } from "../../services/businessTime.js";
import { checkDriverConflict, checkVehicleConflict } from "../../services/conflictService.js";
import { getTravelTime, jobPoint, vehicleDepot } from "../../services/googleMapsService.js";
import { getSchedulingRules } from "../../services/settingsService.js";
import type { AutoSchedulePreview, DriverLoad, ProposedAssignment, SkippedJob } from "./types.js";
import { getDriverWeeklyLoad } from "./weekly-load.js";
function getJobStartCoords(job: any) {
  return jobPoint(job);
}
function getJobEndCoords(job: any) {
  return jobPoint(job, true);
}
export async function previewAutoScheduling(
  startDate: Date,
  endDate: Date,
): Promise<AutoSchedulePreview> {
  const rules = await getSchedulingRules();
  const skippedReasons = new Map<number, string>();
  const transitMinutes = rules.transitTimeMinutes;

  const drivers = await prisma.user.findMany({
    where: { status: "ACTIVE", role: "DRIVER" },
  });

  const vehicles = await prisma.fleetVehicle.findMany({
    where: { status: "ACTIVE" },
    include: { homeDepot: true, assignedDriver: true },
  });

  const unassignedJobs = await prisma.job.findMany({
    where: {
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      yardManaged: false,
      booking: { status: "CONFIRMED" },
      jobStartDateTime: { gte: startDate, lt: endDate },
    },
    include: { booking: true, assignments: { where: { status: { not: "CANCELLED" } } } },
    orderBy: { jobStartDateTime: "asc" },
  });

  const proposed: ProposedAssignment[] = [];
  const skipped: SkippedJob[] = [];

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

        const selectedVehicle = vId ? vehicles.find((v: any) => v.id === vId) : undefined;
        let validForDriver = true;
        const currentProposed: Array<{
          job: any;
          actualStart: Date;
          actualEnd: Date;
          travelToMins: number;
        }> = [];

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

          const hasTentativeConflict = tentativeDriverSlots.some(
            (t) => t.driverId === driverId && t.start < actualEnd && t.end > actualStart,
          );
          if (hasTentativeConflict) {
            validForDriver = false;
            break;
          }

          if (vId) {
            const isBooked = vehicleSlots.some(
              (s) => s.vehicleId === vId && s.start < actualEnd && s.end > actualStart,
            );
            if (isBooked) {
              validForDriver = false;
              break;
            }
            const conflict = await checkVehicleConflict(vId, actualStart, actualEnd);
            if (conflict.hasConflict) {
              validForDriver = false;
              break;
            }
          }

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
          const requiredBufferMins = travel.durationMinutes + (prevEndTime ? 0 : 10);

          if (prevEndTime) {
            const gapMins = (actualStart.getTime() - prevEndTime.getTime()) / 60000;
            if (gapMins < requiredBufferMins) {
              validForDriver = false;
              break;
            }
          }

          try {
            const conflict = await checkDriverConflict(
              driverId,
              actualStart,
              actualEnd,
              undefined,
              job.id,
              rules,
              prisma,
              vId!,
            );
            if (conflict.hasConflict) {
              validForDriver = false;
              break;
            }
          } catch (_) {
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
          for (const pj of currentProposed) {
            tentativeDriverSlots.push({ driverId, start: pj.actualStart, end: pj.actualEnd });
            if (selectedVehicle) {
              vehicleSlots.push({
                vehicleId: selectedVehicle.id,
                start: pj.actualStart,
                end: pj.actualEnd,
              });
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
              travelFromLocation: "Reviewed positioning route",
              travelToMinutes: pj.travelToMins,

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
    if (
      proposed.filter((p) => p.jobId === job.id).length <
      Math.max(0, (job.booking?.noOfVehicles || 1) - job.assignments.length)
    ) {
      skipped.push({
        jobId: job.id,
        jobStartLocation: job.jobStartLocation,
        reason:
          skippedReasons.get(job.id) ||
          "No eligible allocation. Check route reviews, positioning travel, vehicle depots and driver conflicts.",
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
