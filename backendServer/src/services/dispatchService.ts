import { prisma } from "../db.js";
import { getDriversForDispatch } from "./userService.js";
import { getAvailableVehicles } from "./fleetService.js";

/**
 * Fetches all necessary data to render the dispatch board for a given time window.
 */
export async function getBoardData(start: Date, end: Date) {
  // 1. Fetch Drivers
  const drivers = await getDriversForDispatch();

  // 2. Fetch Vehicles available in this window
  const vehicles = await getAvailableVehicles(start, end);

  // 3. Fetch Assignments falling in this window
  const assignments = await prisma.assignment.findMany({
    where: {
      status: { not: "CANCELLED" },
      OR: [
        { scheduledStart: { gte: start, lte: end } },
        { scheduledEnd: { gte: start, lte: end } },
        { scheduledStart: { lte: start }, scheduledEnd: { gte: end } },
      ],
    },
    include: {
      job: {
        include: { 
          booking: { 
            select: { 
              customer: { select: { name: true } },
              bookingType: true,
              passengerCount: true,
              noOfVehicles: true,
              pickupLat: true,
              pickupLng: true,
              dropoffLat: true,
              dropoffLng: true
            } 
          } 
        }
      }
    },
  });

  // 4. Fetch Duty Spans (driver availability) in this window
  const dutySpans = await prisma.driverAvailability.findMany({
    where: {
      startTime: { lt: end },
      endTime: { gt: start },
      isBlocked: false
    }
  });

  // 5. Fetch Unassigned Jobs (jobs with fewer assignments than requested noOfVehicles)
  const allCandidateJobs = await prisma.job.findMany({
    where: {
      status: { in: ["UNASSIGNED", "OPEN", "PENDING", "Pending", "pending", "Open"] },
      jobStartDateTime: { gte: start, lte: end }
    },
    include: {
      assignments: true,
      booking: { 
        select: { 
          customer: { select: { name: true, phone1: true } }, 
          passengerCount: true, 
          noOfVehicles: true,
          bookingType: true,
          pickupLat: true,
          pickupLng: true,
          dropoffLat: true,
          dropoffLng: true
        } 
      }
    },
    orderBy: { jobStartDateTime: 'asc' }
  });

  const unassignedJobs = allCandidateJobs.filter((job: any) => {
    const requiredVehicles = job.booking?.noOfVehicles || 1;
    return job.assignments.length < requiredVehicles;
  });

  return {
    drivers,
    vehicles,
    assignments,
    dutySpans,
    unassignedJobs,
  };
}

/**
 * Lock a resource (DRIVER, VEHICLE, JOB) to prevent concurrent assignments.
 * Pessimistic lock that auto-expires.
 */
export async function acquireLock(resourceType: "DRIVER" | "VEHICLE" | "JOB", resourceId: number, userId: number) {
  const expiresAt = new Date(Date.now() + 15000); // Lock expires in 15 seconds

  // Clean up expired locks first
  await prisma.dispatchLock.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });

  try {
    const lock = await prisma.dispatchLock.upsert({
      where: {
        resourceType_resourceId: { resourceType, resourceId },
      },
      update: {
        lockedBy: userId,
        lockedAt: new Date(),
        expiresAt,
      },
      create: {
        resourceType,
        resourceId,
        lockedBy: userId,
        expiresAt,
      },
    });

    return { success: true, lock };
  } catch (error) {
    // Upsert might fail if another transaction inserted exactly at the same time,
    // though Prisma upsert handles this well. If it fails, resource is locked.
    return { success: false, reason: "Resource is currently locked by another dispatcher." };
  }
}

/**
 * Release a previously acquired lock.
 */
export async function releaseLock(resourceType: "DRIVER" | "VEHICLE" | "JOB", resourceId: number, userId: number) {
  await prisma.dispatchLock.deleteMany({
    where: {
      resourceType,
      resourceId,
      lockedBy: userId, // Only the user who locked it can release it
    }
  });

  return { success: true };
}

/**
 * Fetch analytics data for the dispatch board
 */
export async function getDispatchAnalytics(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const assignments = await prisma.assignment.findMany({
    where: {
      scheduledStart: { gte: startOfDay, lte: endOfDay },
      status: { not: "CANCELLED" }
    }
  });

  const unassignedJobs = await prisma.job.count({
    where: {
      status: "UNASSIGNED",
      jobStartDateTime: { gte: startOfDay, lte: endOfDay }
    }
  });

  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a: any) => a.status === "COMPLETED").length;
  
  // Calculate driver utilization (unique drivers assigned today)
  const uniqueDrivers = new Set(assignments.filter((a: any) => a.driverId).map((a: any) => a.driverId));
  
  // Active drivers count
  const activeDrivers = await prisma.user.count({
    where: { isActive: true, roles: { some: { role: { roleName: "DRIVER" } } } }
  });

  const utilizationRate = activeDrivers > 0 ? (uniqueDrivers.size / activeDrivers) * 100 : 0;

  return {
    totalAssignments,
    unassignedJobs,
    completedAssignments,
    driverUtilization: utilizationRate.toFixed(1),
    activeDrivers,
    assignedDrivers: uniqueDrivers.size,
  };
}

/**
 * Fetch duty spans (availability) for drivers on a specific date.
 */
export async function getDutySpans(start: Date, end: Date) {
  return await prisma.driverAvailability.findMany({
    where: {
      startTime: { lt: end },
      endTime: { gt: start },
      isBlocked: false
    }
  });
}

/**
 * Set duty spans for one or more drivers.
 * Overwrites any existing availability for that driver on that day.
 */
export async function setDutySpan(driverIds: number[], date: Date, startTime: Date, endTime: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const operations = driverIds.map(driverId => [
    // Delete existing spans for this driver on this day
    prisma.driverAvailability.deleteMany({
      where: {
        driverId,
        startTime: { gte: dayStart, lte: dayEnd }
      }
    }),
    // Create new span
    prisma.driverAvailability.create({
      data: {
        driverId,
        startTime,
        endTime,
        isBlocked: false,
        reason: "Duty Span"
      }
    })
  ]).flat();

  return await prisma.$transaction(operations);
}
