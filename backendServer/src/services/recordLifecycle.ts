import { prisma } from "../db.js";
import { WorkflowError } from "./workflowError.js";
export type Resource = "users" | "customers" | "fleet" | "bookings";
const models = { users: "user", customers: "customer", fleet: "fleetVehicle", bookings: "booking" };
const tables = { users: "User", customers: "Customer", fleet: "FleetVehicle", bookings: "Booking" };

export async function assertCanDeactivate(db: any, resource: "users" | "fleet", id: number, now = new Date()) {
  const count = await db.assignment.count({ where: {
    [resource === "users" ? "driverId" : "vehicleId"]: id,
    OR: [{ status: "IN_PROGRESS" }, { status: { in: ["PENDING", "CONFIRMED"] }, OR: [{ scheduledEnd: { gt: now } }, { scheduledStart: { gte: now } }, { scheduledEnd: null }] }],
  } });
  if (count) throw new WorkflowError(`Reassign or cancel ${count} upcoming/in-progress assignment(s) before deactivating this record.`, 409);
}

export async function deletionEligibility(resource: Resource, id: number, db: any = prisma) {
  const record = await db[models[resource]].findUnique({ where: { id } });
  if (!record) throw new WorkflowError("Record not found", 404);
  const reasons: string[] = [];
  const inactive = resource === "customers" ? !record.isActive : String(record.status).toUpperCase() === (resource === "bookings" ? "CANCELLED" : "INACTIVE");
  if (!inactive) reasons.push(resource === "bookings" ? "Cancel this booking first." : "Deactivate this record first.");
  const check = async (model: string, where: any, label: string) => { const n = await db[model].count({ where }); if (n) reasons.push(`${n} ${label} prevent permanent deletion.`); };
  if (resource === "users") {
    await check("assignment", { OR: [{ driverId: id }, { createdBy: id }] }, "assignment references");
    await check("fleetVehicle", { assignedDriverId: id }, "linked vehicles");
    await check("driverAvailability", { driverId: id }, "availability records");
    await check("activityLog", { OR: [{ userId: id }, { entity: { in: ["User", "Employee"] }, entityId: id }] }, "historical references");
  }
  if (resource === "customers") await check("booking", { customerId: id }, "bookings");
  if (resource === "fleet") {
    await check("assignment", { vehicleId: id }, "assignment references");
    if (record.assignedDriverId) reasons.push("Unlink the assigned driver first.");
    await check("activityLog", { entity: { in: ["FleetVehicle", "Vehicle"] }, entityId: id }, "historical references");
  }
  if (resource === "bookings") {
    await check("quotation", { bookingId: id }, "quotations");
    await check("job", { bookingId: id }, "jobs");
    await check("booking", { amendsBookingId: id }, "amendments");
    if (record.amendsBookingId) reasons.push("This booking is an amendment and must be retained.");
  }
  return { id, eligible: reasons.length === 0, reasons };
}

export async function changeRecordLifecycle(resource: Resource, id: number, permanent: boolean, db: any = prisma) {
  try {
    return await db.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
      // Table names are selected solely from the fixed resource map; IDs remain parameters.
      await tx.$queryRawUnsafe(`SELECT id FROM "${tables[resource]}" WHERE id = $1 FOR UPDATE`, id);
      const record = await tx[models[resource]].findUnique({ where: { id } });
      if (!record) throw new WorkflowError("Record not found", 404);
      if (permanent) {
        const eligibility = await deletionEligibility(resource, id, tx);
        if (!eligibility.eligible) throw new WorkflowError(eligibility.reasons.join(" "), 409);
        await tx[models[resource]].delete({ where: { id } });
      } else {
        if (resource === "bookings") throw new WorkflowError("Use the booking cancellation workflow.", 409);
        if (resource === "users" || resource === "fleet") await assertCanDeactivate(tx, resource, id);
        await tx[models[resource]].update({ where: { id }, data: resource === "customers" ? { isActive: false } : { status: "INACTIVE" } });
      }
      await tx.workflowEvent.create({ data: { type: "job.updated", payload: { resource, id, action: permanent ? "deleted" : "deactivated" } } });
      return { success: true, id, action: permanent ? "deleted" : "deactivated" };
    }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch (e: any) {
    if (["P2003", "P2034"].includes(e.code)) throw new WorkflowError("The record acquired a dependency or changed concurrently. Refresh and try again.", 409);
    throw e;
  }
}
