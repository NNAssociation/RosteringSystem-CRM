import { differenceInMinutes } from "date-fns";
import { prisma } from "../db.js";
import { availabilityWindows } from "./availabilityWindows.js";
import { dayWindow, localDate } from "./businessTime.js";
import { getTravelTime, jobPoint, vehicleDepot } from "./googleMapsService.js";
import { getSchedulingRules, type SchedulingRules } from "./settingsService.js";

export interface ConflictResult {
  positioningRouteIds?: number[];
  travelTo?: { durationMinutes: number; distanceKm: number; origin: string };
  hasConflict: boolean;
  reason?: string;
  conflictingEntityId?: number;
}

/**
 * Checks if a driver has any overlapping assignments, availability blocks, or shift rules violations.
 */
export async function checkDriverConflict(
  driverId: number,
  start: Date,
  end: Date,
  excludeAssignmentId?: number,
  jobId?: number,
  rules?: SchedulingRules,
  db: any = prisma,
  vehicleId?: number,
): Promise<ConflictResult> {
  const schedulingRules = rules ?? (await getSchedulingRules());
  // Check driver availability (blocked blocks)
  const blocks = await db.driverAvailability.findMany({
    where: {
      driverId,
      isBlocked: true,
      OR: [
        { dayOfWeek: { not: null } },
        { dayOfWeek: null, startTime: { lt: end }, endTime: { gt: start } },
      ],
    },
  });
  const availabilityBlock = availabilityWindows(blocks, start, end).find(
    (w) => w.start < end && w.end > start,
  )?.block;

  if (availabilityBlock) {
    return {
      hasConflict: true,
      reason: `Driver is unavailable: ${availabilityBlock.reason || "Blocked time"}`,
      conflictingEntityId: availabilityBlock.id,
    };
  }

  // Check overlapping assignments
  const overlapWhere: any = {
    driverId,
    status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
    scheduledStart: { lt: end },
    scheduledEnd: { gt: start },
  };

  if (excludeAssignmentId) {
    overlapWhere.id = { not: excludeAssignmentId };
  }

  const conflictingAssignment = await db.assignment.findFirst({
    where: overlapWhere,
    include: { job: true },
  });

  if (conflictingAssignment) {
    return {
      hasConflict: true,
      reason: `Driver is already assigned to Job #${conflictingAssignment.jobId}`,
      conflictingEntityId: conflictingAssignment.id,
    };
  }

  // Check new shift/travel/break rules
  const shiftRulesResult = await checkDriverShiftRules(
    driverId,
    start,
    start,
    end,
    excludeAssignmentId,
    jobId,
    schedulingRules,
    db,
    vehicleId,
  );
  if (shiftRulesResult.hasConflict) {
    return shiftRulesResult;
  }

  return shiftRulesResult;
}

/**
 * Validates travel time from depot, travel time between jobs, 12h max shift duration,
 * and the 5.5h continuous driving break rule.
 */
export async function checkDriverShiftRules(
  driverId: number,
  date: Date,
  start: Date,
  end: Date,
  excludeAssignmentId?: number,
  jobId?: number,
  rules?: SchedulingRules,
  db: any = prisma,
  vehicleId?: number,
): Promise<ConflictResult> {
  const schedulingRules = rules ?? (await getSchedulingRules());
  const positioningRouteIds: number[] = [];
  let travelTo: ConflictResult["travelTo"];

  // Fetch the job being assigned if jobId is provided
  let newJob: any = null;
  if (jobId) {
    newJob = await db.job.findUnique({
      where: { id: jobId },
      include: { booking: true },
    });
  }

  // Get all existing assignments for the driver on this day
  const { start: dayStart, end: dayEnd } = dayWindow(localDate(date));

  const existingAssignments = await db.assignment.findMany({
    where: {
      driverId,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      scheduledStart: { lt: dayEnd },
      scheduledEnd: { gt: dayStart },
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
    include: {
      job: {
        include: { booking: true },
      },
    },
  });

  // Combine and sort assignments
  const list: Array<{
    vehicleId: number;
    id?: number;
    scheduledStart: Date;
    scheduledEnd: Date;
    jobId: number;
    jobStartLat: number | null;
    jobStartLng: number | null;
    jobEndLat: number | null;
    jobEndLng: number | null;
    durationHours: number;
  }> = [];

  for (const a of existingAssignments) {
    const job = a.job;
    list.push({
      vehicleId: a.vehicleId,
      id: a.id,
      scheduledStart: new Date(a.scheduledStart),
      scheduledEnd: new Date(a.scheduledEnd || new Date(a.scheduledStart.getTime() + 2 * 3600000)),
      jobId: a.jobId,
      jobStartLat: jobPoint(job).lat,
      jobStartLng: jobPoint(job).lng,
      jobEndLat: jobPoint(job, true).lat,
      jobEndLng: jobPoint(job, true).lng,
      durationHours: job?.durationHours ? Number(job.durationHours) : 2,
    });
  }

  if (newJob) {
    list.push({
      vehicleId: vehicleId!,
      scheduledStart: start,
      scheduledEnd: end,
      jobId: newJob.id,
      jobStartLat: jobPoint(newJob).lat,
      jobStartLng: jobPoint(newJob).lng,
      jobEndLat: jobPoint(newJob, true).lat,
      jobEndLng: jobPoint(newJob, true).lng,
      durationHours: newJob.durationHours ? Number(newJob.durationHours) : 2,
    });
  }

  if (list.length === 0) {
    return { hasConflict: false };
  }

  // Sort by scheduledStart
  list.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());

  // 1. First Assignment: Travel time from Depot (Punchbowl Bus Company SB)
  const first = list[0]!;
  const firstDepot = await vehicleDepot(first.vehicleId, db);
  const firstOrigin =
    first.jobStartLat != null && first.jobStartLng != null
      ? { lat: first.jobStartLat, lng: first.jobStartLng }
      : "Missing pickup coordinates";

  const depotToFirst = await getTravelTime(
    { lat: firstDepot.lat, lng: firstDepot.lng },
    firstOrigin,
    { vehicleId: first.vehicleId, at: first.scheduledStart, timing: "ARRIVE_BY", db },
  );

  const travelFromDepotBuffer = depotToFirst.durationMinutes + 10;
  if (first.jobId === jobId)
    travelTo = {
      durationMinutes: depotToFirst.durationMinutes,
      distanceKm: depotToFirst.distanceKm,
      origin: `${firstDepot.lat},${firstDepot.lng}`,
    };
  const shiftStartTime = new Date(
    first.scheduledStart.getTime() - travelFromDepotBuffer * 60 * 1000,
  );

  // 2. Last Assignment: Travel time back to Depot
  const last = list[list.length - 1]!;
  const lastDepot = await vehicleDepot(last.vehicleId, db);
  const lastDest =
    last.jobEndLat != null && last.jobEndLng != null
      ? { lat: last.jobEndLat, lng: last.jobEndLng }
      : "Missing destination coordinates";

  const lastToDepot = await getTravelTime(
    lastDest,
    { lat: lastDepot.lat, lng: lastDepot.lng },
    { vehicleId: last.vehicleId, at: last.scheduledEnd, timing: "DEPART_AT", db },
  );

  const shiftEndTime = new Date(
    last.scheduledEnd.getTime() + (lastToDepot.durationMinutes + 10) * 60 * 1000,
  );

  // 3. Shift Duration Rule
  const shiftDurationMinutes = differenceInMinutes(shiftEndTime, shiftStartTime);
  if (shiftDurationMinutes > schedulingRules.maxShiftDurationMinutes) {
    return {
      hasConflict: true,
      reason: `Assigning this job would exceed the maximum daily shift duration of ${schedulingRules.maxShiftDurationMinutes / 60} hours. Calculated shift: ${Math.round((shiftDurationMinutes / 60) * 10) / 10} hours (including travel to/from depot).`,
    };
  }

  // 4. Consecutive Travel and Continuous Driving checks
  let currentContinuousDrivingMinutes = depotToFirst.durationMinutes;

  for (let i = 0; i < list.length; i++) {
    const current = list[i]!;
    const durationMins = current.durationHours * 60;

    if (durationMins > schedulingRules.maxContinuousDrivingMinutes) {
      return {
        hasConflict: true,
        reason: `Driver would drive for more than ${schedulingRules.maxContinuousDrivingMinutes / 60} continuous hours without a break. (Job #${current.jobId} duration is ${current.durationHours}h).`,
      };
    }

    currentContinuousDrivingMinutes += durationMins;

    if (currentContinuousDrivingMinutes > schedulingRules.maxContinuousDrivingMinutes) {
      return {
        hasConflict: true,
        reason: `Driver would drive for more than ${schedulingRules.maxContinuousDrivingMinutes / 60} continuous hours without a break.`,
      };
    }

    if (i < list.length - 1) {
      const next = list[i + 1]!;
      const gapMins = differenceInMinutes(next.scheduledStart, current.scheduledEnd);

      // Travel Time check between current and next
      const currentDest =
        current.jobEndLat != null && current.jobEndLng != null
          ? { lat: current.jobEndLat, lng: current.jobEndLng }
          : null;
      const nextOrigin =
        next.jobStartLat != null && next.jobStartLng != null
          ? { lat: next.jobStartLat, lng: next.jobStartLng }
          : null;

      let positioningMinutes = 0;
      if (currentDest && nextOrigin) {
        const interJobTravel = await getTravelTime(currentDest, nextOrigin, {
          vehicleId: next.vehicleId,
          at: current.scheduledEnd,
          timing: "DEPART_AT",
          db,
        });
        positioningMinutes = interJobTravel.durationMinutes;
        if (next.jobId === jobId)
          travelTo = {
            durationMinutes: interJobTravel.durationMinutes,
            distanceKm: interJobTravel.distanceKm,
            origin: `${currentDest.lat},${currentDest.lng}`,
          };
        if (gapMins < interJobTravel.durationMinutes) {
          return {
            hasConflict: true,
            reason: `Insufficient travel time between Job #${current.jobId} and Job #${next.jobId}. Required: ${interJobTravel.durationMinutes} mins, available: ${gapMins} mins.`,
          };
        }
      }

      // Continuous Driving Break Rule: Reset counter if gap >= minBreakDurationMinutes
      if (gapMins - positioningMinutes >= schedulingRules.minBreakDurationMinutes) {
        currentContinuousDrivingMinutes = 0;
      } else {
        currentContinuousDrivingMinutes += positioningMinutes;
        if (currentContinuousDrivingMinutes > schedulingRules.maxContinuousDrivingMinutes)
          return {
            hasConflict: true,
            reason: "Positioning travel exceeds the continuous driving limit",
          };
      }
    }
  }

  if (
    currentContinuousDrivingMinutes + lastToDepot.durationMinutes >
    schedulingRules.maxContinuousDrivingMinutes
  )
    return {
      hasConflict: true,
      reason: "Return-to-depot travel exceeds the continuous driving limit",
    };
  return { hasConflict: false, positioningRouteIds, ...(travelTo ? { travelTo } : {}) };
}

/**
 * Checks if a vehicle has any overlapping assignments or maintenance windows.
 */
export async function checkVehicleConflict(
  vehicleId: number,
  start: Date,
  end: Date,
  excludeAssignmentId?: number,
  db: any = prisma,
): Promise<ConflictResult> {
  // Check vehicle status (e.g. MAINTENANCE)
  const vehicle = await db.fleetVehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return { hasConflict: true, reason: "Vehicle not found" };

  if (vehicle.status !== "ACTIVE" && vehicle.status !== "AVAILABLE") {
    return { hasConflict: true, reason: `Vehicle is currently ${vehicle.status}` };
  }

  // Check explicit availability window if set
  if (vehicle.availableFrom && vehicle.availableFrom > start) {
    return { hasConflict: true, reason: "Vehicle is not yet available in the fleet" };
  }
  if (vehicle.availableTo && vehicle.availableTo < end) {
    return { hasConflict: true, reason: "Vehicle is retired or unavailable after this date" };
  }

  // Check overlapping assignments
  const overlapWhere: any = {
    vehicleId,
    status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
    scheduledStart: { lt: end },
    scheduledEnd: { gt: start },
  };

  if (excludeAssignmentId) {
    overlapWhere.id = { not: excludeAssignmentId };
  }

  const conflictingAssignment = await db.assignment.findFirst({
    where: overlapWhere,
    include: { job: true },
  });

  if (conflictingAssignment) {
    return {
      hasConflict: true,
      reason: `Vehicle is already assigned to Job #${conflictingAssignment.jobId}`,
      conflictingEntityId: conflictingAssignment.id,
    };
  }

  return { hasConflict: false };
}

/**
 * Checks if assigning this job would push the driver over their daily fatigue limit.
 * Duration is in hours.
 */
export async function checkDriverFatigue(
  driverId: number,
  date: Date,
  newJobDurationHours: number,
  excludeAssignmentId?: number,
  db: any = prisma,
  rules?: SchedulingRules,
): Promise<ConflictResult> {
  const schedulingRules = rules ?? (await getSchedulingRules());

  // Get driver's fatigue limit from their profile or fallback to system maxShiftDurationMinutes setting
  const profile = await db.userProfile.findUnique({
    where: { userId: driverId },
    select: { maxfatigueMinutes: true },
  });

  const maxMinutes = profile?.maxfatigueMinutes || schedulingRules.maxShiftDurationMinutes || 720;
  const maxHours = maxMinutes / 60;

  // Calculate total hours already assigned on this day
  const { start: dayStart, end: dayEnd } = dayWindow(localDate(date));

  const assignmentsWhere: any = {
    driverId,
    status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
    scheduledStart: { lt: dayEnd },
    scheduledEnd: { gt: dayStart },
  };

  if (excludeAssignmentId) {
    assignmentsWhere.id = { not: excludeAssignmentId };
  }

  const dailyAssignments = await db.assignment.findMany({
    where: assignmentsWhere,
    include: { job: { select: { durationHours: true } } },
  });

  // Calculate duration of existing assignments. If no duration provided on job, assume 2 hours default.
  let currentHours = 0;
  for (const assignment of dailyAssignments) {
    const hours =
      Math.max(
        0,
        Math.min(new Date(assignment.scheduledEnd).getTime(), dayEnd.getTime()) -
          Math.max(new Date(assignment.scheduledStart).getTime(), dayStart.getTime()),
      ) / 3600000;
    currentHours += hours;
  }

  if (currentHours + newJobDurationHours > maxHours) {
    return {
      hasConflict: true,
      reason: `Assigning this job (${newJobDurationHours}h) would exceed the driver's daily fatigue limit of ${maxHours}h. Current assigned hours: ${currentHours}h.`,
    };
  }

  return { hasConflict: false };
}

export async function checkVehicleCapacity(
  vehicleId: number,
  passengerCount: number,
  db: any = prisma,
): Promise<ConflictResult> {
  const vehicle = await db.fleetVehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return { hasConflict: true, reason: "Vehicle not found" };

  if (
    vehicle.maxPassengers !== null &&
    vehicle.maxPassengers !== undefined &&
    passengerCount > vehicle.maxPassengers
  ) {
    return {
      hasConflict: true,
      reason: `Vehicle has ${vehicle.maxPassengers} seats but booking requires ${passengerCount} passengers`,
    };
  }

  return { hasConflict: false };
}
