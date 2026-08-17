import { prisma } from "../db.js";
import { endOfDay, startOfDay, subHours, differenceInMinutes } from "date-fns";
import { getTravelTime, DEPOT_LOCATION } from "./googleMapsService.js";
import { getSchedulingRules, type SchedulingRules } from "./settingsService.js";

export interface ConflictResult {
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
  rules?: SchedulingRules
): Promise<ConflictResult> {
  const schedulingRules = rules ?? await getSchedulingRules();
  // Check driver availability (blocked blocks)
  const dayOfWeek = start.getDay();
  const availabilityBlock = await prisma.driverAvailability.findFirst({
    where: {
      driverId,
      isBlocked: true,
      OR: [
        { dayOfWeek }, // Recurring weekly block
        { dayOfWeek: null, startTime: { lte: end }, endTime: { gte: start } }, // Specific date override
      ],
    },
  });

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
    status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
    scheduledStart: { lt: end },
    scheduledEnd: { gt: start },
  };

  if (excludeAssignmentId) {
    overlapWhere.id = { not: excludeAssignmentId };
  }

  const conflictingAssignment = await prisma.assignment.findFirst({
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
    schedulingRules
  );
  if (shiftRulesResult.hasConflict) {
    return shiftRulesResult;
  }

  return { hasConflict: false };
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
  rules?: SchedulingRules
): Promise<ConflictResult> {
  const schedulingRules = rules ?? await getSchedulingRules();

  // Fetch the job being assigned if jobId is provided
  let newJob: any = null;
  if (jobId) {
    newJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { booking: true },
    });
  }

  // Find driver's assigned vehicle to get depot location, fallback to driver's depot, then DEPOT_LOCATION
  const driverDepotLat = DEPOT_LOCATION.lat;
  const driverDepotLng = DEPOT_LOCATION.lng;
  const driverDepotAddress = DEPOT_LOCATION.address;

  // Get all existing assignments for the driver on this day
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const existingAssignments = await prisma.assignment.findMany({
    where: {
      driverId,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      scheduledStart: { gte: dayStart, lte: dayEnd },
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
      id: a.id,
      scheduledStart: new Date(a.scheduledStart),
      scheduledEnd: new Date(a.scheduledEnd || new Date(a.scheduledStart.getTime() + 2 * 3600000)),
      jobId: a.jobId,
      jobStartLat: job?.jobStartLat ?? job?.booking?.pickupLat ?? null,
      jobStartLng: job?.jobStartLng ?? job?.booking?.pickupLng ?? null,
      jobEndLat: job?.jobEndLat ?? job?.booking?.dropoffLat ?? null,
      jobEndLng: job?.jobEndLng ?? job?.booking?.dropoffLng ?? null,
      durationHours: job?.durationHours ? Number(job.durationHours) : 2,
    });
  }

  if (newJob) {
    list.push({
      scheduledStart: start,
      scheduledEnd: end,
      jobId: newJob.id,
      jobStartLat: newJob.jobStartLat ?? newJob.booking?.pickupLat ?? null,
      jobStartLng: newJob.jobStartLng ?? newJob.booking?.pickupLng ?? null,
      jobEndLat: newJob.jobEndLat ?? newJob.booking?.dropoffLat ?? null,
      jobEndLng: newJob.jobEndLng ?? newJob.booking?.dropoffLng ?? null,
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
  const firstOrigin = (first.jobStartLat && first.jobStartLng)
    ? { lat: first.jobStartLat, lng: first.jobStartLng }
    : driverDepotAddress;
  
  const depotToFirst = await getTravelTime(
    { lat: driverDepotLat, lng: driverDepotLng },
    firstOrigin
  );
  
  const travelFromDepotBuffer = depotToFirst.durationMinutes + 10;
  const shiftStartTime = new Date(first.scheduledStart.getTime() - travelFromDepotBuffer * 60 * 1000);

  // 2. Last Assignment: Travel time back to Depot
  const last = list[list.length - 1]!;
  const lastDest = (last.jobEndLat && last.jobEndLng)
    ? { lat: last.jobEndLat, lng: last.jobEndLng }
    : driverDepotAddress;
  
  const lastToDepot = await getTravelTime(
    lastDest,
    { lat: driverDepotLat, lng: driverDepotLng }
  );
  
  const shiftEndTime = new Date(last.scheduledEnd.getTime() + (lastToDepot.durationMinutes + 10) * 60 * 1000);

  // 3. Shift Duration Rule
  const shiftDurationMinutes = differenceInMinutes(shiftEndTime, shiftStartTime);
  if (shiftDurationMinutes > schedulingRules.maxShiftDurationMinutes) {
    return {
      hasConflict: true,
      reason: `Assigning this job would exceed the maximum daily shift duration of ${schedulingRules.maxShiftDurationMinutes / 60} hours. Calculated shift: ${Math.round((shiftDurationMinutes / 60) * 10) / 10} hours (including travel to/from depot).`,
    };
  }

  // 4. Consecutive Travel and Continuous Driving checks
  let currentContinuousDrivingMinutes = 0;

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
      const currentDest = (current.jobEndLat && current.jobEndLng)
        ? { lat: current.jobEndLat, lng: current.jobEndLng }
        : null;
      const nextOrigin = (next.jobStartLat && next.jobStartLng)
        ? { lat: next.jobStartLat, lng: next.jobStartLng }
        : null;

      if (currentDest && nextOrigin) {
        const interJobTravel = await getTravelTime(currentDest, nextOrigin);
        if (gapMins < interJobTravel.durationMinutes) {
          return {
            hasConflict: true,
            reason: `Insufficient travel time between Job #${current.jobId} and Job #${next.jobId}. Required: ${interJobTravel.durationMinutes} mins, available: ${gapMins} mins.`,
          };
        }
      }

      // Continuous Driving Break Rule: Reset counter if gap >= minBreakDurationMinutes
      if (gapMins >= schedulingRules.minBreakDurationMinutes) {
        currentContinuousDrivingMinutes = 0;
      }
    }
  }

  return { hasConflict: false };
}

/**
 * Checks if a vehicle has any overlapping assignments or maintenance windows.
 */
export async function checkVehicleConflict(
  vehicleId: number,
  start: Date,
  end: Date,
  excludeAssignmentId?: number
): Promise<ConflictResult> {
  // Check vehicle status (e.g. MAINTENANCE)
  const vehicle = await prisma.fleetVehicle.findUnique({ where: { id: vehicleId } });
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
    status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
    scheduledStart: { lt: end },
    scheduledEnd: { gt: start },
  };

  if (excludeAssignmentId) {
    overlapWhere.id = { not: excludeAssignmentId };
  }

  const conflictingAssignment = await prisma.assignment.findFirst({
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
  excludeAssignmentId?: number
): Promise<ConflictResult> {
  // Get driver's fatigue limit from their profile
  const profile = await prisma.userProfile.findUnique({
    where: { userId: driverId },
    select: { maxfatigueMinutes: true },
  });

  const maxMinutes = profile?.maxfatigueMinutes || 600; // Default 10 hours if not set
  const maxHours = maxMinutes / 60;

  // Calculate total hours already assigned on this day
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const assignmentsWhere: any = {
    driverId,
    status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
    scheduledStart: { gte: dayStart, lte: dayEnd },
  };

  if (excludeAssignmentId) {
    assignmentsWhere.id = { not: excludeAssignmentId };
  }

  const dailyAssignments = await prisma.assignment.findMany({
    where: assignmentsWhere,
    include: { job: { select: { durationHours: true } } },
  });

  // Calculate duration of existing assignments. If no duration provided on job, assume 2 hours default.
  let currentHours = 0;
  for (const assignment of dailyAssignments) {
    const hours = assignment.job?.durationHours ? Number(assignment.job.durationHours) : 2;
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
  passengerCount: number
): Promise<ConflictResult> {
  const vehicle = await prisma.fleetVehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return { hasConflict: true, reason: "Vehicle not found" };
  
  if (vehicle.maxPassengers !== null && vehicle.maxPassengers !== undefined && passengerCount > vehicle.maxPassengers) {
    return {
      hasConflict: true,
      reason: `Vehicle has ${vehicle.maxPassengers} seats but booking requires ${passengerCount} passengers`,
    };
  }
  
  return { hasConflict: false };
}
