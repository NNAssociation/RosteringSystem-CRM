import { z } from "zod";
import { prisma } from "../db.js";
import { isOffice, type EmployeeActor } from "../middleware/employeeAuth.js";
import { WorkflowError } from "./workflowError.js";
export const positiveId = z.coerce.number().int().positive();
export const textField = z.string().trim().min(1).max(10000);
export const versionInput = z.object({ version: positiveId });
export const roles = ["DRIVER", "MECHANIC", "YARD", "DISPATCHER", "MANAGER", "ADMIN"] as const;
export const contextFields = {
  vehicleId: positiveId.nullable().optional(),
  bookingId: positiveId.nullable().optional(),
  jobId: positiveId.nullable().optional(),
};
export const personSelect = { id: true, firstName: true, lastName: true, role: true };
export const office = (actor: EmployeeActor) => {
  if (!isOffice(actor)) throw new WorkflowError("Office staff access is required", 403);
};
export const scope = (actor: EmployeeActor, model?: string) =>
  isOffice(actor)
    ? {}
    : {
        OR: [
          { reporterId: actor.id },
          { ownerId: actor.id },
          ...(model === "foundPropertyItem" ? [{ custodianId: actor.id }] : []),
        ],
      };
export function checkVersion(row: any, version: number) {
  if (row.version !== version)
    throw new WorkflowError("This record changed. Refresh before trying again.", 409);
}
export async function transaction<T>(fn: (tx: any) => Promise<T>, db: any = prisma): Promise<T> {
  try {
    return await db.$transaction(fn, { isolationLevel: "Serializable", timeout: 20000 });
  } catch (e: any) {
    if (["P2034", "P2002"].includes(e.code))
      throw new WorkflowError("Another employee changed this record. Refresh and try again.", 409);
    if (e.code === "P2003")
      throw new WorkflowError("A linked record cannot be changed or removed.", 409);
    throw e;
  }
}
export async function audit(
  tx: any,
  actor: EmployeeActor,
  entity: string,
  entityId: number,
  action: string,
  changes: any = {},
) {
  await tx.activityLog.create({
    data: {
      userId: actor.id,
      entity,
      entityId,
      action,
      changes: JSON.parse(JSON.stringify(changes)),
    },
  });
}
export async function notify(
  tx: any,
  ids: number[],
  entity: string,
  entityId: number,
  title: string,
  href: string,
) {
  const active = await tx.user.findMany({
    where: { id: { in: [...new Set(ids)] }, status: "ACTIVE" },
    select: { id: true },
  });
  if (active.length)
    await tx.notification.createMany({
      data: active.map((u: any) => ({ userId: u.id, entity, entityId, title, href })),
    });
}
export async function officeIds(tx: any) {
  return (
    await tx.user.findMany({
      where: { status: "ACTIVE", role: { in: ["ADMIN", "MANAGER", "DISPATCHER"] } },
      select: { id: true },
    })
  ).map((u: any) => u.id);
}
export async function activeEmployee(tx: any, id?: number | null) {
  if (
    id &&
    !(await tx.user.findFirst({
      where: { id, status: "ACTIVE", role: { not: null } },
      select: { id: true },
    }))
  )
    throw new WorkflowError("Choose an active employee");
}
export async function validateContext(tx: any, actor: EmployeeActor, input: any) {
  for (const [field, model] of [
    ["vehicleId", "fleetVehicle"],
    ["bookingId", "booking"],
    ["jobId", "job"],
    ["assignmentId", "assignment"],
    ["customerId", "customer"],
    ["depotId", "depot"],
  ]) {
    if (
      input[field!] &&
      !(await tx[model!].findUnique({ where: { id: input[field!] }, select: { id: true } }))
    )
      throw new WorkflowError(`Invalid ${field}`);
  }
  if (!isOffice(actor)) {
    if (input.customerId || input.bookingId) {
      if (!input.jobId && !input.assignmentId)
        throw new WorkflowError("Select one of your assigned jobs", 403);
    }
    if (input.jobId || input.assignmentId || input.bookingId) {
      const assignment = await tx.assignment.findFirst({
        where: {
          driverId: actor.id,
          ...(input.assignmentId ? { id: input.assignmentId } : {}),
          ...(input.jobId ? { jobId: input.jobId } : {}),
          ...(input.bookingId ? { job: { bookingId: input.bookingId } } : {}),
        },
      });
      if (!assignment) throw new WorkflowError("This job is not assigned to you", 403);
    }
  }
  if (input.assignmentId) {
    const a = await tx.assignment.findUnique({ where: { id: input.assignmentId } });
    if (
      (input.jobId && a.jobId !== input.jobId) ||
      (input.vehicleId && a.vehicleId !== input.vehicleId)
    )
      throw new WorkflowError("Assignment does not match the selected job or vehicle");
  }
  if (
    input.jobId &&
    input.bookingId &&
    (await tx.job.findUnique({ where: { id: input.jobId } })).bookingId !== input.bookingId
  )
    throw new WorkflowError("Job does not belong to the selected booking");
}
export function pagination(raw: any) {
  const q = z
    .object({
      page: positiveId.default(1),
      pageSize: positiveId.max(100).default(25),
      search: z.string().max(200).default(""),
      status: z.string().max(50).optional(),
      category: z.string().max(50).optional(),
      vehicleId: positiveId.optional(),
      bookingId: positiveId.optional(),
      jobId: positiveId.optional(),
      from: z.iso.datetime({ offset: true }).optional(),
      to: z.iso.datetime({ offset: true }).optional(),
      view: z.enum(["all", "unread", "acknowledgement", "archived"]).default("all"),
    })
    .parse(raw);
  return { ...q, skip: (q.page - 1) * q.pageSize };
}
export function listWhere(q: ReturnType<typeof pagination>, field = "description") {
  return {
    ...(q.search ? { [field]: { contains: q.search, mode: "insensitive" } } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.category ? { category: q.category } : {}),
    ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}),
    ...(q.bookingId ? { bookingId: q.bookingId } : {}),
    ...(q.jobId ? { jobId: q.jobId } : {}),
    ...(q.from || q.to
      ? {
          occurredAt: {
            ...(q.from ? { gte: new Date(q.from) } : {}),
            ...(q.to ? { lte: new Date(q.to) } : {}),
          },
        }
      : {}),
  };
}
export async function scopedRecord(
  tx: any,
  model: string,
  id: number,
  actor: EmployeeActor,
  include: any = {},
) {
  const row = await tx[model].findFirst({ where: { id, ...scope(actor, model) }, include });
  if (!row) throw new WorkflowError("Record not found", 404);
  return row;
}
