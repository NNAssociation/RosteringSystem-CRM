import { prisma } from "../db.js";
import { availabilityWindows } from "./availabilityWindows.js";
import { businessTimeZone, dayWindow, localDate } from "./businessTime.js";
import { getDriversForDispatch } from "./userService.js";
import { WorkflowError } from "./workflowError.js";

/**
 * Fetches all necessary data to render the dispatch board for a given time window.
 */
export async function getBoardData(start: Date, end: Date) {
  // 1. Fetch Drivers
  const drivers = await getDriversForDispatch();

  // 2. Fetch Vehicles available in this window
  const vehicles = await prisma.fleetVehicle.findMany({
    where: { status: { in: ["ACTIVE", "AVAILABLE"] } },
    include: { assignedDriver: true },
  });

  // 3. Fetch Assignments falling in this window
  const assignments = await prisma.assignment.findMany({
    where: {
      status: { not: "CANCELLED" },
      job: { booking: { status: "CONFIRMED" } },
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
    },
    include: {
      driver: true,
      vehicle: true,
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
              dropoffLng: true,
              stops: true,
            },
          },
        },
      },
    },
  });

  // 4. Fetch Duty Spans (driver availability) in this window
  const availability = await prisma.driverAvailability.findMany({
    where: {
      OR: [{ dayOfWeek: { not: null } }, { startTime: { lt: end }, endTime: { gt: start } }],
      isBlocked: false,
    },
  });
  const dutySpans = availabilityWindows(availability, start, end)
    .filter((w) => w.start < end && w.end > start)
    .map((w) => ({
      ...w.block,
      id: `${w.block.id}-${w.start.toISOString()}`,
      startTime: w.start,
      endTime: w.end,
    }));

  // 5. Fetch Unassigned Jobs (jobs with fewer assignments than requested noOfVehicles)
  const allCandidateJobs = await prisma.job.findMany({
    where: {
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      booking: { status: "CONFIRMED" },
      jobStartDateTime: { lt: end },
      jobEndDateTime: { gt: start },
    },
    include: {
      assignments: { where: { status: { not: "CANCELLED" } } },
      booking: {
        select: {
          customer: { select: { name: true, phone1: true } },
          passengerCount: true,
          noOfVehicles: true,
          bookingType: true,
          pickupLat: true,
          pickupLng: true,
          dropoffLat: true,
          dropoffLng: true,
          stops: true,
        },
      },
    },
    orderBy: { jobStartDateTime: "asc" },
  });

  const unassignedJobs = allCandidateJobs.filter((job: any) => {
    const requiredVehicles = job.booking?.noOfVehicles || 1;
    return job.assignments.length < requiredVehicles;
  });

  return {
    timeZone: businessTimeZone(),
    windowStart: start,
    windowEnd: end,
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
export async function acquireLock(
  resourceType: "DRIVER" | "VEHICLE" | "JOB",
  resourceId: number,
  userId: number,
) {
  const expiresAt = new Date(Date.now() + 15000); // Lock expires in 15 seconds

  return prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
    const existing = await tx.dispatchLock.findUnique({
      where: { resourceType_resourceId: { resourceType, resourceId } },
    });
    if (existing && existing.expiresAt > new Date() && existing.lockedBy !== userId)
      return { success: false, reason: "Resource is locked by another dispatcher." };
    // Clean up expired locks first
    await tx.dispatchLock.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    try {
      const lock = await tx.dispatchLock.upsert({
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
  });
}

/**
 * Release a previously acquired lock.
 */
export async function releaseLock(
  resourceType: "DRIVER" | "VEHICLE" | "JOB",
  resourceId: number,
  userId: number,
) {
  await prisma.dispatchLock.deleteMany({
    where: {
      resourceType,
      resourceId,
      lockedBy: userId, // Only the user who locked it can release it
    },
  });

  return { success: true };
}

/**
 * Fetch analytics data for the dispatch board
 */
export async function getDispatchAnalytics(date: Date) {
  const { start, end } = dayWindow(localDate(date));
  const board = await getBoardData(start, end);
  const assignments = board.assignments;
  const unassignedJobs = board.unassignedJobs.length;
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a: any) => a.status === "COMPLETED").length;

  // Calculate driver utilization (unique drivers assigned today)
  const uniqueDrivers = new Set(
    assignments.filter((a: any) => a.driverId).map((a: any) => a.driverId),
  );

  // Active drivers count
  const activeDrivers = await prisma.user.count({
    where: { status: "ACTIVE", role: "DRIVER" },
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
      isBlocked: false,
    },
  });
}

/**
 * Set duty spans for one or more drivers.
 * Overwrites any existing availability for that driver on that day.
 */
export async function setDutySpan(
  driverIds: number[],
  date: Date,
  input: Date | { startTime: Date; endTime: Date }[],
  legacyEnd?: Date,
) {
  const spans = (input instanceof Date ? [{ startTime: input, endTime: legacyEnd! }] : input)
    .slice()
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const { start: dayStart, end: dayEnd } = dayWindow(localDate(date));
  if (
    !spans.length ||
    spans.length > 12 ||
    spans.some(
      (s) =>
        !s.endTime ||
        !Number.isFinite(s.startTime.getTime()) ||
        !Number.isFinite(s.endTime.getTime()) ||
        s.endTime <= s.startTime ||
        s.startTime < dayStart ||
        s.startTime >= dayEnd ||
        s.endTime.getTime() - s.startTime.getTime() > 86400000,
    )
  )
    throw new WorkflowError("Invalid duty window");
  if (spans.some((s, i) => i > 0 && s.startTime < spans[i - 1]!.endTime))
    throw new WorkflowError("Duty spans must not overlap");
  if (
    !driverIds.length ||
    driverIds.length > 500 ||
    driverIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
  )
    throw new WorkflowError("Invalid driver selection");
  return prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
    const assignments = await tx.assignment.findMany({
      where: {
        driverId: { in: driverIds },
        status: { not: "CANCELLED" },
        scheduledStart: { gte: dayStart, lt: dayEnd },
      },
    });
    if (
      assignments.some(
        (a: any) =>
          !a.scheduledEnd ||
          !spans.some((s) => a.scheduledStart >= s.startTime && a.scheduledEnd <= s.endTime),
      )
    )
      throw new WorkflowError(
        "Existing assignments fall outside this availability. Reassign them first.",
        409,
      );
    const result = [];
    for (const driverId of new Set(driverIds)) {
      const otherSpans = await tx.driverAvailability.findMany({
        where: {
          driverId,
          dayOfWeek: null,
          source: "MANUAL",
          isBlocked: false,
          OR: [
            { startTime: { lt: dayStart }, endTime: { gt: spans[0]!.startTime } },
            { startTime: { gte: dayEnd, lt: spans[spans.length - 1]!.endTime } },
          ],
        },
      });
      if (
        otherSpans.some((other: any) =>
          spans.some((s) => s.startTime < other.endTime && s.endTime > other.startTime),
        )
      )
        throw new WorkflowError("Duty spans overlap availability on another day", 409);
      await tx.driverAvailability.deleteMany({
        where: {
          driverId,
          startTime: { gte: dayStart, lt: dayEnd },
          dayOfWeek: null,
          source: "MANUAL",
          isBlocked: false,
        },
      });
      for (const span of spans)
        result.push(
          await tx.driverAvailability.create({
            data: {
              driverId,
              ...span,
              isBlocked: false,
              reason: "Planned availability",
              source: "MANUAL",
            },
          }),
        );
    }
    await tx.workflowEvent.create({
      data: { type: "job.updated", payload: { availabilityChanged: true } },
    });
    return result;
  });
}
