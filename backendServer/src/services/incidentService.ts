import { z } from "zod";
import { prisma } from "../db.js";
import { isOffice, type EmployeeActor } from "../middleware/employeeAuth.js";
import { WorkflowError } from "./workflowError.js";
import {
  activeEmployee,
  audit,
  checkVersion,
  contextFields,
  listWhere,
  notify,
  office,
  officeIds,
  pagination,
  personSelect,
  positiveId,
  scope,
  scopedRecord,
  textField,
  transaction,
  validateContext,
} from "./workplaceCommon.js";

export const incidentCategories = [
  "COLLISION",
  "INJURY",
  "BREAKDOWN",
  "VEHICLE_DAMAGE",
  "PASSENGER_ISSUE",
  "CUSTOMER_PASSENGER_INCIDENT",
  "NEAR_MISS",
  "OTHER",
] as const;

export const incidentInput = z.object({
  title: textField.max(200),
  description: textField,
  occurredAt: z.iso.datetime({ offset: true }),
  location: textField.max(500),
  category: z.enum(incidentCategories),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  immediateAction: z.string().max(10000).default(""),
  unsafeVehicle: z.boolean().default(false),
  injury: z.boolean().default(false),
  emergencyServices: z.boolean().default(false),
  policeInvolved: z.boolean().default(false),
  safeToContinue: z.boolean().default(true),
  investigationSummary: z.string().max(10000).default(""),
  correctiveActions: z.string().max(10000).default(""),
  internalNotes: z.string().max(10000).default(""),
  outcomeSummary: z.string().max(10000).default(""),
  ...contextFields,
  assignmentId: positiveId.nullable().optional(),
});

export function generateIncidentRef(occurredAt: Date) {
  const d = new Date(occurredAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `IR-${yyyy}${mm}${dd}-${rand}`;
}

export async function incidentDetail(id: number, actor: EmployeeActor, db: any = prisma) {
  return scopedRecord(db, "incident", id, actor, {
    reporter: { select: personSelect },
    owner: { select: personSelect },
    vehicle: { select: { id: true, licensePlate: true } },
    updates: {
      where: isOffice(actor) ? {} : { officeOnly: false },
      orderBy: { createdAt: "asc" },
      include: { author: { select: personSelect } },
    },
    actions: { orderBy: { id: "asc" } },
  });
}

export async function listIncidents(raw: any, actor: EmployeeActor) {
  const q = pagination(raw),
    where =
      raw.attention === "true"
        ? {
            AND: [
              scope(actor),
              listWhere(q, "title"),
              {
                OR: [
                  { status: "SUBMITTED" },
                  { unsafeVehicle: true, fleetDecision: null },
                  {
                    severity: { in: ["HIGH", "CRITICAL"] },
                    status: { notIn: ["RESOLVED", "CLOSED"] },
                  },
                ],
              },
            ],
          }
        : { ...scope(actor), ...listWhere(q, "title") };
  const [items, total] = await prisma.$transaction([
    prisma.incident.findMany({
      where,
      skip: q.skip,
      take: q.pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: { select: personSelect },
        assignment: { select: { driver: { select: personSelect } } },
        owner: { select: personSelect },
        vehicle: { select: { id: true, licensePlate: true } },
      },
    }),
    prisma.incident.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function createIncident(actor: EmployeeActor, raw: unknown) {
  const input = incidentInput.parse(raw);
  if (input.unsafeVehicle && !input.vehicleId)
    throw new WorkflowError("Select the vehicle reported unsafe");
  return transaction(async (tx) => {
    await validateContext(tx, actor, input);
    const occurredAtDate = new Date(input.occurredAt);
    const reference = generateIncidentRef(occurredAtDate);
    const row = await tx.incident.create({
      data: { ...input, occurredAt: occurredAtDate, reporterId: actor.id, reference },
    });
    await audit(tx, actor, "Incident", row.id, "INCIDENT_SUBMITTED");
    await notify(
      tx,
      await officeIds(tx),
      "Incident",
      row.id,
      input.unsafeVehicle || ["HIGH", "CRITICAL"].includes(input.severity)
        ? "Urgent incident requires review"
        : "New incident submitted",
      `/dashboard/incidents/${row.id}`,
    );
    return row;
  });
}

export function validateIncidentTransition(
  row: any,
  status: string,
  reason: string,
  outstanding: number,
) {
  const transitions: Record<string, string[]> = {
    SUBMITTED: ["UNDER_REVIEW", "CLOSED"],
    UNDER_REVIEW: ["IN_PROGRESS", "CLOSED"],
    IN_PROGRESS: ["RESOLVED", "CLOSED"],
    RESOLVED: ["CLOSED", "IN_PROGRESS"],
    CLOSED: ["IN_PROGRESS"],
  };
  if (!transitions[row.status]?.includes(status))
    throw new WorkflowError("Invalid incident transition", 409);
  if (["RESOLVED", "CLOSED"].includes(status) || ["RESOLVED", "CLOSED"].includes(row.status)) {
    if (!reason.trim())
      throw new WorkflowError("A resolution, closure, or reopening reason is required");
  }
  if (status === "RESOLVED" && outstanding)
    throw new WorkflowError("Complete outstanding corrective actions before resolving", 409);
}

export async function incidentAction(id: number, actor: EmployeeActor, action: string, raw: any) {
  const version = positiveId.parse(raw.version);
  return transaction(async (tx) => {
    const row = await incidentDetail(id, actor, tx);
    checkVersion(row, version);
    let data: any = { version: { increment: 1 } };
    if (action === "update") {
      const input = z
        .object({ body: textField, officeOnly: z.boolean().default(false) })
        .parse(raw);
      if (input.officeOnly) office(actor);
      if (row.status === "CLOSED")
        throw new WorkflowError("Reopen this incident before adding updates", 409);
      await tx.incidentUpdate.create({ data: { ...input, incidentId: id, authorId: actor.id } });
    } else if (action === "complete-action") {
      if (row.status === "CLOSED") throw new WorkflowError("Incident is closed", 409);
      if (!isOffice(actor) && row.ownerId !== actor.id)
        throw new WorkflowError("Only the assigned owner can complete actions", 403);
      const result = await tx.incidentAction.updateMany({
        where: { id: positiveId.parse(raw.actionId), incidentId: id, completedAt: null },
        data: { completedAt: new Date(), completedById: actor.id },
      });
      if (!result.count) throw new WorkflowError("Action is missing or already complete", 409);
    } else {
      office(actor);
      if (action === "save-progress") {
        const input = z
          .object({
            status: z
              .enum(["SUBMITTED", "UNDER_REVIEW", "IN_PROGRESS", "RESOLVED", "CLOSED"])
              .optional(),
            severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
            ownerId: positiveId.nullable().optional(),
            investigationSummary: z.string().max(10000).optional(),
            correctiveActions: z.string().max(10000).optional(),
            internalNotes: z.string().max(10000).optional(),
            outcomeSummary: z.string().max(10000).optional(),
          })
          .parse(raw);
        if (input.ownerId !== undefined && input.ownerId !== null) {
          await activeEmployee(tx, input.ownerId);
        }
        data = { ...data, ...input };
      } else if (action === "close") {
        data.status = "CLOSED";
        const reason = raw.reason || raw.outcomeSummary || "";
        if (reason) data.outcomeSummary = String(reason);
        await tx.incidentUpdate.create({
          data: {
            incidentId: id,
            authorId: actor.id,
            body: `Incident report closed${reason ? `: ${reason}` : ""}`,
          },
        });
      } else if (action === "assign") {
        const input = z
          .object({
            ownerId: positiveId.nullable(),
            dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
            severity: incidentInput.shape.severity.optional(),
          })
          .parse(raw);
        await activeEmployee(tx, input.ownerId);
        data = { ...data, ...input, dueAt: input.dueAt ? new Date(input.dueAt) : null };
      } else if (action === "add-action") {
        if (["RESOLVED", "CLOSED"].includes(row.status))
          throw new WorkflowError("Reopen before adding corrective actions", 409);
        await tx.incidentAction.create({
          data: { incidentId: id, description: textField.parse(raw.description) },
        });
      } else if (action === "transition") {
        const input = z
          .object({
            status: z.enum(["UNDER_REVIEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
            reason: z.string().max(10000).default(""),
            duplicateOfId: positiveId.optional(),
          })
          .parse(raw);
        validateIncidentTransition(
          row,
          input.status,
          input.reason,
          row.actions.filter((a: any) => !a.completedAt).length,
        );
        if (input.duplicateOfId) {
          if (input.duplicateOfId === id)
            throw new WorkflowError("An incident cannot duplicate itself");
          await incidentDetail(input.duplicateOfId, actor, tx);
          data.duplicateOfId = input.duplicateOfId;
        }
        data.status = input.status;
        if (input.status === "RESOLVED") data.resolution = input.reason;
        if (input.status === "CLOSED" && input.reason) data.outcomeSummary = input.reason;
        await tx.incidentUpdate.create({
          data: {
            incidentId: id,
            authorId: actor.id,
            body: `${row.status} → ${input.status}${input.reason ? `: ${input.reason}` : ""}`,
          },
        });
      } else if (action === "fleet-impact") {
        if (!row.vehicleId) throw new WorkflowError("No vehicle is linked");
        const decision = z.enum(["MAINTENANCE", "NO_CHANGE"]).parse(raw.decision);
        const reason = textField.parse(raw.reason);
        data.fleetDecision = decision;
        if (decision === "MAINTENANCE") {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
          await tx.fleetVehicle.update({
            where: { id: row.vehicleId },
            data: { status: "MAINTENANCE" },
          });
          await tx.workflowEvent.create({
            data: { type: "job.updated", payload: { vehicleId: row.vehicleId } },
          });
          await audit(tx, actor, "FleetVehicle", row.vehicleId, "INCIDENT_FLEET_IMPACT", {
            incidentId: id,
            reason,
            decision,
          });
        }
        await tx.incidentUpdate.create({
          data: {
            incidentId: id,
            authorId: actor.id,
            body: `Fleet decision: ${decision}. ${reason}`,
          },
        });
      } else throw new WorkflowError("Unknown incident action");
    }
    const updated = await tx.incident.update({ where: { id }, data });
    await audit(
      tx,
      actor,
      "Incident",
      id,
      `INCIDENT_${action.toUpperCase().replaceAll("-", "_")}`,
      {
        previousVersion: version,
        before: {
          status: row.status,
          ownerId: row.ownerId,
          severity: row.severity,
          dueAt: row.dueAt,
          fleetDecision: row.fleetDecision,
        },
        after: {
          status: updated.status,
          ownerId: updated.ownerId,
          severity: updated.severity,
          dueAt: updated.dueAt,
          fleetDecision: updated.fleetDecision,
        },
      },
    );
    await notify(
      tx,
      [...(await officeIds(tx)), row.reporterId, ...(updated.ownerId ? [updated.ownerId] : [])],
      "Incident",
      id,
      "An incident has been updated",
      `/dashboard/incidents/${id}`,
    );
    return updated;
  });
}
