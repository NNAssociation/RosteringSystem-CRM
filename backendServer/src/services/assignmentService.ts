import { prisma } from "../db.js";
import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from "../validators/assignmentSchema.js";
import { availabilityWindows } from "./availabilityWindows.js";
import { addDateDays, dayWindow, localDate } from "./businessTime.js";
import {
  checkDriverConflict,
  checkDriverFatigue,
  checkVehicleConflict,
} from "./conflictService.js";
import { getTravelTime, jobPoint, vehicleDepot } from "./googleMapsService.js";
import { getSchedulingRules } from "./settingsService.js";
import { WorkflowError } from "./workflowError.js";

export async function adjustDriverDutySpan(
  tx: any,
  driverId: number,
  date: Date,
  allowPending = false,
) {
  const { start, end } = dayWindow(localDate(date));
  const rows = await tx.assignment.findMany({
    where: {
      driverId,
      status: { not: "CANCELLED" },
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
    },
    orderBy: { scheduledStart: "asc" },
    include: { job: true, vehicle: { include: { homeDepot: true } } },
  });
  await tx.driverAvailability.deleteMany({
    where: { driverId, source: "CALCULATED", startTime: { lt: end }, endTime: { gt: start } },
  });
  if (!rows.length) return;
  const first = rows[0],
    last = [...rows].sort((a: any, b: any) => b.scheduledEnd - a.scheduledEnd)[0];
  try {
    const depot = await vehicleDepot(first.vehicleId, tx),
      returnDepot = await vehicleDepot(last.vehicleId, tx);
    const origin = jobPoint(first.job),
      destination = jobPoint(last.job, true);
    const inbound = await getTravelTime({ lat: depot.lat, lng: depot.lng }, origin, {
      vehicleId: first.vehicleId,
      at: first.scheduledStart,
      timing: "ARRIVE_BY",
      db: tx,
    });
    const outbound = await getTravelTime(
      destination,
      { lat: returnDepot.lat, lng: returnDepot.lng },
      { vehicleId: last.vehicleId, at: last.scheduledEnd, timing: "DEPART_AT", db: tx },
    );
    const positioning = [{ row: first, origin: `${depot.lat},${depot.lng}`, travel: inbound }];
    for (let i = 1; i < rows.length; i++) {
      const previous = rows[i - 1],
        next = rows[i],
        from = jobPoint(previous.job, true);
      const travel = await getTravelTime(from, jobPoint(next.job), {
        vehicleId: next.vehicleId,
        at: previous.scheduledEnd,
        timing: "DEPART_AT",
        db: tx,
      });
      positioning.push({ row: next, origin: `${from.lat},${from.lng}`, travel });
    }
    const ids: number[] = [];
    // Inserting/removing a job also changes the next assignment's positioning display and provenance.
    for (const { row, origin: from, travel } of positioning) {
      if (
        row.travelToMinutes !== travel.durationMinutes ||
        row.travelToKm !== travel.distanceKm ||
        row.travelFromLocation !== from ||
        JSON.stringify(row.positioningRouteIds || []) !== JSON.stringify(ids)
      ) {
        await tx.assignment.update({
          where: { id: row.id, version: row.version },
          data: {
            travelToMinutes: travel.durationMinutes,
            travelToKm: travel.distanceKm,
            travelFromLocation: from,
            positioningRouteIds: ids,
            version: { increment: 1 },
          },
        });
        await tx.workflowEvent.create({
          data: { type: "assignment.updated", payload: { assignmentId: row.id } },
        });
      }
    }
    await tx.driverAvailability.create({
      data: {
        driverId,
        source: "CALCULATED",
        isBlocked: false,
        reason: "Calculated duty",
        startTime: new Date(
          first.scheduledStart.getTime() - (inbound.durationMinutes + 10) * 60000,
        ),
        endTime: new Date(last.scheduledEnd.getTime() + (outbound.durationMinutes + 10) * 60000),
      },
    });
  } catch (error) {
    if (!allowPending || !(error instanceof WorkflowError)) throw error;
    await tx.activityLog.create({
      data: {
        entity: "User",
        entityId: driverId,
        action: "DUTY_REVIEW_REQUIRED",
        changes: { date: localDate(date), reason: error.message },
      },
    });
  }
}

export async function cancelBookingAssignments(tx: any, bookingId: number) {
  const rows = await tx.assignment.findMany({
    where: { job: { bookingId }, status: { not: "CANCELLED" } },
  });
  await tx.assignment.updateMany({
    where: { job: { bookingId }, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED", version: { increment: 1 } },
  });
  const refreshed = new Set<string>();
  for (const row of rows) {
    if (!row.driverId) continue;
    const key = `${row.driverId}:${localDate(row.scheduledStart)}`;
    if (refreshed.has(key)) continue;
    refreshed.add(key);
    await adjustDriverDutySpan(tx, row.driverId, row.scheduledStart, true);
  }
}

export function assertTripTimes(job: any, start: Date, end: Date) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    throw new WorkflowError("Invalid assignment time window");
  if (
    start.getTime() !== new Date(job.jobStartDateTime).getTime() ||
    end.getTime() !== new Date(job.jobEndDateTime).getTime()
  )
    throw new WorkflowError(
      "Assignment must preserve the confirmed trip times. Create a booking amendment to reschedule.",
      409,
    );
}
async function validate(
  tx: any,
  jobId: number,
  driverId: number | null | undefined,
  vehicleId: number | null | undefined,
  start: Date,
  end: Date,
  excludeId?: number,
  userId?: number,
) {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    include: {
      booking: true,
      assignments: {
        where: { status: { not: "CANCELLED" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
        include: { vehicle: true },
      },
    },
  });
  if (
    !job ||
    job.booking?.status !== "CONFIRMED" ||
    ["CANCELLED", "COMPLETED"].includes(job.status)
  )
    throw new WorkflowError("Only confirmed, active bookings can be dispatched", 409);
  if (!driverId && !vehicleId)
    throw new WorkflowError("Select at least a driver or a vehicle for this assignment");
  assertTripTimes(job, start, end);
  const lockQueries: any[] = [{ resourceType: "JOB", resourceId: jobId }];
  if (driverId) lockQueries.push({ resourceType: "DRIVER", resourceId: driverId });
  if (vehicleId) lockQueries.push({ resourceType: "VEHICLE", resourceId: vehicleId });
  const locks = await tx.dispatchLock.findMany({
    where: { expiresAt: { gt: new Date() }, OR: lockQueries },
  });
  if (locks.some((l: any) => l.lockedBy !== userId))
    throw new WorkflowError("A resource is locked by another dispatcher", 423);

  const required = job.booking.noOfVehicles || 1;
  if (job.assignments.length >= required && !excludeId)
    throw new WorkflowError("All requested vehicles are already assigned", 409);

  if (driverId) {
    const driver = await tx.user.findUnique({ where: { id: driverId } });
    if (!driver || driver.role !== "DRIVER" || driver.status !== "ACTIVE")
      throw new WorkflowError("Driver is not available for assignment");
    if (job.assignments.some((a: any) => a.driverId === driverId))
      throw new WorkflowError("This driver already covers this job", 409);
    const availability = await tx.driverAvailability.findMany({
      where: {
        driverId,
        source: "MANUAL",
        isBlocked: false,
        OR: [
          { dayOfWeek: { not: null } },
          {
            startTime: { lt: dayWindow(localDate(end)).end },
            endTime: { gt: dayWindow(localDate(start)).start },
          },
        ],
      },
    });
    const windows = availabilityWindows(availability, start, end).filter(
      (w) => w.start < dayWindow(localDate(end)).end && w.end > dayWindow(localDate(start)).start,
    );
    if (windows.length && !windows.some((w) => w.start <= start && w.end >= end))
      throw new WorkflowError("Job is outside the driver's planned availability");
    const rules = await getSchedulingRules();
    const result = await checkDriverConflict(
      driverId,
      start,
      end,
      excludeId,
      jobId,
      rules,
      tx,
      vehicleId ?? undefined,
    );
    if (result.hasConflict) throw new WorkflowError(result.reason || "Scheduling conflict", 409);
    if (result.positioningRouteIds) job.positioningRouteIds = result.positioningRouteIds;
    if (result.travelTo) job.reviewedTravelTo = result.travelTo;

    for (
      let day = localDate(start);
      day <= localDate(new Date(end.getTime() - 1));
      day = addDateDays(day, 1)
    ) {
      const window = dayWindow(day);
      const hours =
        (Math.min(end.getTime(), window.end.getTime()) -
          Math.max(start.getTime(), window.start.getTime())) /
        3600000;
      const fatigue = await checkDriverFatigue(driverId, window.start, hours, excludeId, tx, rules);
      if (fatigue.hasConflict)
        throw new WorkflowError(fatigue.reason || "Driver workload exceeded", 409);
    }
  }

  if (vehicleId) {
    if (job.assignments.some((a: any) => a.vehicleId === vehicleId))
      throw new WorkflowError("This vehicle already covers this job", 409);
    const vehicle = await tx.fleetVehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new WorkflowError("Selected vehicle does not exist");
    if (!vehicle.maxPassengers)
      throw new WorkflowError("Record passenger capacity for selected vehicle", 422);
    const vehicleCap = vehicle.maxPassengers;
    const capacity = job.assignments.reduce(
      (n: number, a: any) => n + (a.vehicle?.maxPassengers || 0),
      vehicleCap,
    );
    if (job.assignments.length + 1 === required && capacity < job.booking.passengerCount) {
      throw new WorkflowError(
        `Combined vehicle capacity is ${capacity}, but ${job.booking.passengerCount} seats are required`,
      );
    }
    const result = await checkVehicleConflict(vehicleId, start, end, excludeId, tx);
    if (result.hasConflict) throw new WorkflowError(result.reason || "Scheduling conflict", 409);
  }

  return job;
}
async function jobStatus(tx: any, jobId: number) {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    include: { booking: true, assignments: { where: { status: { not: "CANCELLED" } } } },
  });
  if (!job || job.booking?.status !== "CONFIRMED") return;
  const status = !job.assignments.length
    ? "UNASSIGNED"
    : job.assignments.every((a: any) => a.status === "COMPLETED") &&
        job.assignments.length >= (job.booking.noOfVehicles || 1)
      ? "COMPLETED"
      : job.assignments.length < (job.booking.noOfVehicles || 1)
        ? "PARTIALLY_ASSIGNED"
        : "ASSIGNED";
  await tx.job.update({ where: { id: jobId }, data: { status } });
}
export async function createAssignment(
  input: CreateAssignmentInput,
  meta?: { userId?: number | undefined },
) {
  return prisma.$transaction(
    async (tx: any) => {
      // One database lock covers manual and automatic mutations, including cross-resource races.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
      const source = await tx.job.findUnique({ where: { id: input.jobId } });
      const start = new Date(input.scheduledStart),
        end = new Date(input.scheduledEnd || source?.jobEndDateTime);
      const validated = await validate(
        tx,
        input.jobId,
        input.driverId,
        input.vehicleId,
        start,
        end,
        undefined,
        meta?.userId,
      );
      const row = await tx.assignment.create({
        data: {
          ...input,
          travelToMinutes: validated.reviewedTravelTo?.durationMinutes ?? null,
          travelToKm: validated.reviewedTravelTo?.distanceKm ?? null,
          travelFromLocation: validated.reviewedTravelTo?.origin ?? null,
          positioningRouteIds: validated.positioningRouteIds,
          scheduledStart: start,
          scheduledEnd: end,
          status: "CONFIRMED",
          createdBy: meta?.userId,
        },
        include: { job: true, driver: true, vehicle: true },
      });
      await jobStatus(tx, input.jobId);
      if (input.driverId) await adjustDriverDutySpan(tx, input.driverId, start);
      await tx.workflowEvent.create({
        data: { type: "assignment.created", payload: { assignmentId: row.id, jobId: input.jobId } },
      });
      return row;
    },
    { maxWait: 15000, timeout: 60000 },
  );
}
export async function updateAssignment(
  id: number,
  input: UpdateAssignmentInput,
  meta?: { userId?: number | undefined },
) {
  return prisma.$transaction(
    async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
      const current = await tx.assignment.findUnique({ where: { id } });
      if (!current || current.version !== input.version)
        throw new WorkflowError("Assignment changed. Refresh and try again.", 409);
      if (["CANCELLED", "COMPLETED"].includes(current.status))
        throw new WorkflowError("This assignment can no longer be changed", 409);
      const driverId = input.driverId === undefined ? current.driverId : input.driverId;
      const vehicleId = input.vehicleId === undefined ? current.vehicleId : input.vehicleId;
      if (
        current.status === "IN_PROGRESS" &&
        (driverId !== current.driverId ||
          vehicleId !== current.vehicleId ||
          input.status === "CANCELLED")
      )
        throw new WorkflowError("An in-progress assignment cannot be reassigned or cancelled", 409);
      if (current.status === "IN_PROGRESS" && (input.scheduledStart || input.scheduledEnd))
        throw new WorkflowError("An in-progress assignment's schedule cannot be changed", 409);
      const start = new Date(input.scheduledStart || current.scheduledStart),
        end = new Date(input.scheduledEnd || current.scheduledEnd);
      const validated =
        current.status !== "IN_PROGRESS" && input.status !== "CANCELLED"
          ? await validate(tx, current.jobId, driverId, vehicleId, start, end, id, meta?.userId)
          : null;
      if (input.status === "COMPLETED" && current.status !== "IN_PROGRESS")
        throw new WorkflowError("Start the assignment before completing it", 409);
      const { version, actualStart, actualEnd, ...rest } = input;
      const row = await tx.assignment.update({
        where: { id, version },
        data: {
          ...rest,
          ...(validated
            ? {
                travelToMinutes: validated.reviewedTravelTo?.durationMinutes ?? null,
                travelToKm: validated.reviewedTravelTo?.distanceKm ?? null,
                travelFromLocation: validated.reviewedTravelTo?.origin ?? null,
                positioningRouteIds: validated.positioningRouteIds,
              }
            : {}),
          scheduledStart: start,
          scheduledEnd: end,
          version: { increment: 1 },
          ...(input.status === "IN_PROGRESS" ? { actualStart: new Date() } : {}),
          ...(input.status === "COMPLETED" ? { actualEnd: new Date() } : {}),
        },
        include: { job: true, driver: true, vehicle: true },
      });
      await jobStatus(tx, current.jobId);
      if (current.status !== "IN_PROGRESS")
        for (const d of new Set<number>([current.driverId, driverId].filter(Boolean)))
          await adjustDriverDutySpan(tx, d, start, input.status === "CANCELLED");
      await tx.workflowEvent.create({
        data: { type: "assignment.updated", payload: { assignmentId: id } },
      });
      return row;
    },
    { maxWait: 15000, timeout: 60000 },
  );
}
export async function deleteAssignment(
  id: number,
  meta?: { userId?: number | undefined },
  version?: number,
) {
  return prisma.$transaction(
    async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
      const row = await tx.assignment.findUnique({ where: { id } });
      if (!row || row.status === "CANCELLED") return { success: true, id };
      if (version === undefined || version !== row.version)
        throw new WorkflowError("Assignment changed. Refresh before unassigning.", 409);
      if (["IN_PROGRESS", "COMPLETED"].includes(row.status))
        throw new WorkflowError("Started assignments cannot be unassigned", 409);
      await tx.assignment.update({
        where: { id, version },
        data: { status: "CANCELLED", version: { increment: 1 } },
      });
      await jobStatus(tx, row.jobId);
      if (row.driverId) await adjustDriverDutySpan(tx, row.driverId, row.scheduledStart, true);
      await tx.workflowEvent.create({
        data: { type: "assignment.cancelled", payload: { assignmentId: id, jobId: row.jobId } },
      });
      return { success: true, id };
    },
    { maxWait: 15000, timeout: 60000 },
  );
}
