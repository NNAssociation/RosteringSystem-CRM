import { prisma } from "../db.js";
import { WorkflowError } from "./workflowError.js";
import { checkDriverConflict, checkVehicleConflict, checkDriverFatigue } from "./conflictService.js";
import { getSchedulingRules } from "./settingsService.js";
import { getTravelTime, DEPOT_LOCATION } from "./googleMapsService.js";
import { dayWindow, localDate, addDateDays } from "./businessTime.js";
import { availabilityWindows } from "./availabilityWindows.js";
import type { CreateAssignmentInput, UpdateAssignmentInput } from "../validators/assignmentSchema.js";

export async function adjustDriverDutySpan(tx: any, driverId: number, date: Date) {
  const { start, end } = dayWindow(localDate(date));
  const rows = await tx.assignment.findMany({ where: { driverId, status: { not: "CANCELLED" }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } }, orderBy: { scheduledStart: "asc" }, include: { job: true, vehicle: { include: { homeDepot: true } } } });
  await tx.driverAvailability.deleteMany({ where: { driverId, source: "CALCULATED", startTime: { lt: end }, endTime: { gt: start } } });
  if (!rows.length) return;
  const first = rows[0], last = [...rows].sort((a: any, b: any) => b.scheduledEnd - a.scheduledEnd)[0];
  const depot = first.vehicle?.homeDepot || DEPOT_LOCATION;
  const origin = first.job.jobStartLat != null ? { lat: first.job.jobStartLat, lng: first.job.jobStartLng } : first.job.jobStartLocation || DEPOT_LOCATION.address;
  const destination = last.job.jobEndLat != null ? { lat: last.job.jobEndLat, lng: last.job.jobEndLng } : last.job.jobEndLocation || DEPOT_LOCATION.address;
  const inbound = await getTravelTime({ lat: depot.lat, lng: depot.lng }, origin);
  const outbound = await getTravelTime(destination, { lat: depot.lat, lng: depot.lng });
  await tx.driverAvailability.create({ data: { driverId, source: "CALCULATED", isBlocked: false, reason: "Calculated duty",
    startTime: new Date(first.scheduledStart.getTime() - (inbound.durationMinutes + 10) * 60000),
    endTime: new Date(last.scheduledEnd.getTime() + (outbound.durationMinutes + 10) * 60000) } });
}

export async function cancelBookingAssignments(tx: any, bookingId: number) {
  const rows = await tx.assignment.findMany({ where: { job: { bookingId }, status: { not: "CANCELLED" } } });
  await tx.assignment.updateMany({ where: { job: { bookingId }, status: { not: "CANCELLED" } }, data: { status: "CANCELLED", version: { increment: 1 } } });
  const refreshed = new Set<string>();
  for (const row of rows) {
    if (!row.driverId) continue;
    const key = `${row.driverId}:${localDate(row.scheduledStart)}`;
    if (refreshed.has(key)) continue;
    refreshed.add(key);
    await adjustDriverDutySpan(tx, row.driverId, row.scheduledStart);
  }
}

export function assertTripTimes(job: any, start: Date, end: Date) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new WorkflowError("Invalid assignment time window");
  if (start.getTime() !== new Date(job.jobStartDateTime).getTime() || end.getTime() !== new Date(job.jobEndDateTime).getTime()) throw new WorkflowError("Assignment must preserve the confirmed trip times. Create a booking amendment to reschedule.", 409);
}
async function validate(tx: any, jobId: number, driverId: number | null | undefined, vehicleId: number | null | undefined, start: Date, end: Date, excludeId?: number, userId?: number) {
  const job = await tx.job.findUnique({ where: { id: jobId }, include: { booking: true, assignments: { where: { status: { not: "CANCELLED" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, include: { vehicle: true } } } });
  if (!job || job.booking?.status !== "CONFIRMED" || ["CANCELLED", "COMPLETED"].includes(job.status)) throw new WorkflowError("Only confirmed, active bookings can be dispatched", 409);
  if (!driverId || !vehicleId) throw new WorkflowError("Select both a driver and a vehicle");
  assertTripTimes(job, start, end);
  const locks = await tx.dispatchLock.findMany({ where: { expiresAt: { gt: new Date() }, OR: [{ resourceType: "JOB", resourceId: jobId }, { resourceType: "DRIVER", resourceId: driverId }, { resourceType: "VEHICLE", resourceId: vehicleId }] } });
  if (locks.some((l: any) => l.lockedBy !== userId)) throw new WorkflowError("A resource is locked by another dispatcher", 423);
  const driver = await tx.user.findUnique({ where: { id: driverId } });
  if (!driver || driver.role !== "DRIVER" || driver.status !== "ACTIVE") throw new WorkflowError("Driver is not available for assignment");
  const required = job.booking.noOfVehicles || 1;
  if (job.assignments.length >= required) throw new WorkflowError("All requested vehicles are already assigned", 409);
  if (job.assignments.some((a: any) => a.driverId === driverId || a.vehicleId === vehicleId)) throw new WorkflowError("This driver or vehicle already covers this job", 409);
  const vehicle = await tx.fleetVehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new WorkflowError("Selected vehicle does not exist");
  const vehicleCap = vehicle.maxPassengers && vehicle.maxPassengers > 0 ? vehicle.maxPassengers : 55;
  const capacity = job.assignments.reduce((n: number, a: any) => n + (a.vehicle?.maxPassengers || 55), vehicleCap);
  if (job.assignments.length + 1 === required && capacity < job.booking.passengerCount) throw new WorkflowError(`Combined vehicle capacity is ${capacity}, but ${job.booking.passengerCount} seats are required`);
  const availability = await tx.driverAvailability.findMany({ where: { driverId, source: "MANUAL", isBlocked: false, OR: [{ dayOfWeek: { not: null } }, { startTime: { lt: dayWindow(localDate(end)).end }, endTime: { gt: dayWindow(localDate(start)).start } }] } });
  const windows = availabilityWindows(availability, start, end).filter(w => w.start < dayWindow(localDate(end)).end && w.end > dayWindow(localDate(start)).start);
  if (windows.length && !windows.some(w => w.start <= start && w.end >= end)) throw new WorkflowError("Job is outside the driver's planned availability");
  const rules = await getSchedulingRules();
  for (const result of [await checkDriverConflict(driverId, start, end, excludeId, jobId, rules, tx), await checkVehicleConflict(vehicleId, start, end, excludeId, tx)]) {
    if (result.hasConflict) throw new WorkflowError(result.reason || "Scheduling conflict", 409);
  }
  for (let day = localDate(start); day <= localDate(new Date(end.getTime() - 1)); day = addDateDays(day, 1)) {
    const window = dayWindow(day);
    const hours = (Math.min(end.getTime(), window.end.getTime()) - Math.max(start.getTime(), window.start.getTime())) / 3600000;
    const fatigue = await checkDriverFatigue(driverId, window.start, hours, excludeId, tx);
    if (fatigue.hasConflict) throw new WorkflowError(fatigue.reason || "Driver workload exceeded", 409);
  }
  return job;
}
async function jobStatus(tx: any, jobId: number) {
  const job = await tx.job.findUnique({ where: { id: jobId }, include: { booking: true, assignments: { where: { status: { not: "CANCELLED" } } } } });
  if (!job || job.booking?.status !== "CONFIRMED") return;
  const status = !job.assignments.length ? "UNASSIGNED" : job.assignments.every((a: any) => a.status === "COMPLETED") && job.assignments.length >= (job.booking.noOfVehicles || 1) ? "COMPLETED" : job.assignments.length < (job.booking.noOfVehicles || 1) ? "PARTIALLY_ASSIGNED" : "ASSIGNED";
  await tx.job.update({ where: { id: jobId }, data: { status } });
}
export async function createAssignment(input: CreateAssignmentInput, meta?: { userId?: number | undefined }) {
  return prisma.$transaction(async (tx: any) => {
    // One database lock covers manual and automatic mutations, including cross-resource races.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
    const source = await tx.job.findUnique({ where: { id: input.jobId } });
    const start = new Date(input.scheduledStart), end = new Date(input.scheduledEnd || source?.jobEndDateTime);
    await validate(tx, input.jobId, input.driverId, input.vehicleId, start, end, undefined, meta?.userId);
    const row = await tx.assignment.create({ data: { ...input, scheduledStart: start, scheduledEnd: end, status: "CONFIRMED", createdBy: meta?.userId }, include: { job: true, driver: true, vehicle: true } });
    await jobStatus(tx, input.jobId);
    await adjustDriverDutySpan(tx, input.driverId!, start);
    await tx.workflowEvent.create({ data: { type: "assignment.created", payload: { assignmentId: row.id, jobId: input.jobId } } });
    return row;
  }, { maxWait: 15000, timeout: 60000 });
}
export async function updateAssignment(id: number, input: UpdateAssignmentInput, meta?: { userId?: number | undefined }) {
  return prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
    const current = await tx.assignment.findUnique({ where: { id } });
    if (!current || current.version !== input.version) throw new WorkflowError("Assignment changed. Refresh and try again.", 409);
    if (["CANCELLED", "COMPLETED"].includes(current.status)) throw new WorkflowError("This assignment can no longer be changed", 409);
    const driverId = input.driverId === undefined ? current.driverId : input.driverId;
    const vehicleId = input.vehicleId === undefined ? current.vehicleId : input.vehicleId;
    if (current.status === "IN_PROGRESS" && (driverId !== current.driverId || vehicleId !== current.vehicleId || input.status === "CANCELLED")) throw new WorkflowError("An in-progress assignment cannot be reassigned or cancelled", 409);
    const start = new Date(input.scheduledStart || current.scheduledStart), end = new Date(input.scheduledEnd || current.scheduledEnd);
    if (input.status !== "CANCELLED") await validate(tx, current.jobId, driverId, vehicleId, start, end, id, meta?.userId);
    if (input.status === "COMPLETED" && current.status !== "IN_PROGRESS") throw new WorkflowError("Start the assignment before completing it", 409);
    const { version, actualStart, actualEnd, ...rest } = input;
    const row = await tx.assignment.update({ where: { id, version }, data: { ...rest, scheduledStart: start, scheduledEnd: end, version: { increment: 1 }, ...(input.status === "IN_PROGRESS" ? { actualStart: new Date() } : {}), ...(input.status === "COMPLETED" ? { actualEnd: new Date() } : {}) }, include: { job: true, driver: true, vehicle: true } });
    await jobStatus(tx, current.jobId);
    for (const d of new Set<number>([current.driverId, driverId].filter(Boolean))) await adjustDriverDutySpan(tx, d, start);
    await tx.workflowEvent.create({ data: { type: "assignment.updated", payload: { assignmentId: id } } });
    return row;
  }, { maxWait: 15000, timeout: 60000 });
}
export async function deleteAssignment(id: number, meta?: { userId?: number | undefined }, version?: number) {
  return prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
    const row = await tx.assignment.findUnique({ where: { id } });
    if (!row || row.status === "CANCELLED") return { success: true, id };
    if (version === undefined || version !== row.version) throw new WorkflowError("Assignment changed. Refresh before unassigning.", 409);
    if (["IN_PROGRESS", "COMPLETED"].includes(row.status)) throw new WorkflowError("Started assignments cannot be unassigned", 409);
    await tx.assignment.update({ where: { id, version }, data: { status: "CANCELLED", version: { increment: 1 } } });
    await jobStatus(tx, row.jobId);
    if (row.driverId) await adjustDriverDutySpan(tx, row.driverId, row.scheduledStart);
    await tx.workflowEvent.create({ data: { type: "assignment.cancelled", payload: { assignmentId: id, jobId: row.jobId } } });
    return { success: true, id };
  }, { maxWait: 15000, timeout: 60000 });
}
