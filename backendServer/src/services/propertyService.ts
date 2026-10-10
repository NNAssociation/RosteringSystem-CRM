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

export const propertyInput = z.object({
  description: z.string().default(""),
  message: z.string().optional(),
  category: z.string().max(80).default("GENERAL"),
  colour: z.string().max(100).default(""),
  brand: z.string().max(100).default(""),
  identifyingDetails: z.string().max(2000).default(""),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  location: textField.max(500),
  status: z.enum(["SUBMITTED", "IN_STORAGE", "OWNER_CONTACTED", "RETURNED", "CLOSED"]).optional(),
  reporterId: positiveId.optional().nullable(),
  ...contextFields,
});

export const propertyModel = (kind: string) =>
  kind === "reports" ? "lostPropertyReport" : "foundPropertyItem";
export const propertyEntity = (kind: string) =>
  kind === "reports" ? "LostPropertyReport" : "FoundPropertyItem";
const href = (kind: string, id: number) => `/dashboard/lost-property/${kind}/${id}`;

export async function propertyDetail(
  kind: string,
  id: number,
  actor: EmployeeActor,
  db: any = prisma,
) {
  const row = await scopedRecord(db, propertyModel(kind), id, actor, {
    reporter: { select: personSelect },
    owner: { select: personSelect },
    vehicle: { select: { id: true, licensePlate: true } },
    ...(kind === "reports"
      ? isOffice(actor)
        ? { privateDetails: true }
        : {}
      : { custodian: { select: personSelect }, custody: { orderBy: { createdAt: "asc" } } }),
    ...(isOffice(actor) ? { matches: { orderBy: { createdAt: "desc" } } } : {}),
  });
  if (!isOffice(actor)) {
    delete row.customerId;
    if (row.custody) row.custody = row.custody.map(({ details, ...event }: any) => event);
  }
  if (isOffice(actor))
    row.history = await db.activityLog.findMany({
      where: { entity: propertyEntity(kind), entityId: id },
      orderBy: { timestamp: "desc" },
      take: 100,
    });
  return row;
}

export async function listProperty(kind: string, raw: any, actor: EmployeeActor) {
  const q = pagination(raw),
    where = { ...scope(actor, propertyModel(kind)), ...listWhere(q) },
    model = propertyModel(kind);
  const [items, total] = await (prisma as any).$transaction([
    (prisma as any)[model].findMany({
      where,
      skip: q.skip,
      take: q.pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        ...(kind === "items" ? { custodian: { select: personSelect } } : {}),
        vehicle: { select: { id: true, licensePlate: true } },
        reporter: { select: personSelect },
      },
    }),
    (prisma as any)[model].count({ where }),
  ]);
  if (!isOffice(actor))
    items.forEach((item: any) => {
      delete item.customerId;
    });
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function createProperty(kind: string, actor: EmployeeActor, raw: any) {
  const input = propertyInput.parse(raw);
  const desc = input.message?.trim() || input.description?.trim() || "Found property";
  return transaction(async (tx) => {
    await validateContext(tx, actor, input);
    let extra: any = {};
    if (kind === "reports") {
      if (raw.claimant || raw.customerId) office(actor);
      if (raw.customerId) {
        extra.customerId = positiveId.parse(raw.customerId);
        await validateContext(tx, actor, extra);
      }
      if (raw.claimant)
        extra.privateDetails = {
          create: z
            .object({
              name: z.string().max(200),
              contact: z.string().max(500),
              notes: z.string().max(10000).default(""),
            })
            .parse(raw.claimant),
        };
    } else {
      const initialStatus = isOffice(actor) && input.status ? input.status : "SUBMITTED";
      extra = {
        custodianId: actor.id,
        storageLocation: raw.storageLocation
          ? String(raw.storageLocation).slice(0, 500)
          : input.location || "",
        depotId: raw.depotId ? positiveId.parse(raw.depotId) : null,
        status: initialStatus,
      };
      await validateContext(tx, actor, extra);
    }
    const { message, reporterId, status, ...cleanInput } = input;
    const finalReporterId = isOffice(actor) && reporterId ? reporterId : actor.id;
    const row = await tx[propertyModel(kind)].create({
      data: {
        ...cleanInput,
        description: desc,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        reporterId: finalReporterId,
        ...extra,
      },
    });
    if (kind === "items")
      await tx.propertyCustodyEvent.create({
        data: {
          itemId: row.id,
          actorId: actor.id,
          kind: extra.status || "FOUND",
          toCustodianId: actor.id,
          toLocation: row.storageLocation || row.location,
        },
      });
    await audit(tx, actor, propertyEntity(kind), row.id, "PROPERTY_REGISTERED");
    await notify(
      tx,
      await officeIds(tx),
      propertyEntity(kind),
      row.id,
      "New property record requires review",
      href(kind, row.id),
    );
    return row;
  });
}

export async function propertyAction(
  kind: string,
  id: number,
  actor: EmployeeActor,
  action: string,
  raw: any,
) {
  const version = positiveId.parse(raw.version);
  return transaction(async (tx) => {
    const row = await propertyDetail(kind, id, actor, tx);
    checkVersion(row, version);
    if (
      ["RETURNED", "DISPOSED", "CLOSED"].includes(row.status) &&
      !["reopen", "status"].includes(action)
    ) {
      throw new WorkflowError("This record is final and cannot be changed", 409);
    }
    let data: any = { version: { increment: 1 } };
    let history: any = { action };
    if (action === "update") {
      if (!isOffice(actor) && row.reporterId !== actor.id && row.ownerId !== actor.id)
        throw new WorkflowError("You cannot update this record", 403);
      const input = propertyInput.partial().parse(raw);
      if (input.message) input.description = input.message;
      if (["vehicleId", "jobId", "bookingId"].some((key) => key in input))
        await validateContext(tx, actor, input);
      const { message, ...cleanInput } = input;
      data = {
        ...data,
        ...cleanInput,
        ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt) } : {}),
      };
      if (raw.customerId !== undefined && kind === "reports") {
        office(actor);
        data.customerId = positiveId.nullable().parse(raw.customerId);
        await validateContext(tx, actor, { customerId: data.customerId });
      }
      history = {
        action,
        before: { description: row.description, identifyingDetails: row.identifyingDetails },
        after: input,
      };
      if (raw.claimant) {
        office(actor);
        if (kind !== "reports") throw new WorkflowError("Claimant details belong to a lost report");
        const claimant = z
          .object({
            name: z.string().max(200),
            contact: z.string().max(500),
            notes: z.string().max(10000).default(""),
          })
          .parse(raw.claimant);
        await tx.propertyClaimant.upsert({
          where: { reportId: id },
          create: { reportId: id, ...claimant },
          update: claimant,
        });
      }
    } else if (action === "transition" || action === "status") {
      office(actor);
      const input = z
        .object({
          status: z.enum(["SUBMITTED", "IN_STORAGE", "OWNER_CONTACTED", "RETURNED", "CLOSED"]),
          reason: z.string().max(10000).optional(),
        })
        .parse(raw);
      data.status = input.status;
      if (kind === "items") {
        await tx.propertyCustodyEvent.create({
          data: {
            itemId: id,
            actorId: actor.id,
            kind: input.status,
            toLocation: row.storageLocation || row.location,
            details: input.reason ? { reason: input.reason } : undefined,
          },
        });
      }
    } else if (action === "assign") {
      office(actor);
      data.ownerId = positiveId.nullable().parse(raw.ownerId);
      await activeEmployee(tx, data.ownerId);
    } else if (action === "close") {
      office(actor);
      history.reason = raw.reason ? textField.parse(raw.reason) : "Closed";
      if (row.status === "MATCHED")
        throw new WorkflowError("Release the active match before closing", 409);
      data.status = "CLOSED";
    } else if (action === "transfer" && kind === "items") {
      if (!isOffice(actor) && row.custodianId !== actor.id && row.ownerId !== actor.id)
        throw new WorkflowError("Only the custodian or handler may transfer an item", 403);
      const input = z
        .object({
          custodianId: positiveId,
          storageLocation: textField.max(500),
          depotId: positiveId.nullable().optional(),
        })
        .parse(raw);
      await activeEmployee(tx, input.custodianId);
      await validateContext(tx, actor, { depotId: input.depotId });
      data = { ...data, ...input, status: row.status === "RESERVED" ? "RESERVED" : "IN_STORAGE" };
      if (row.status === "RESERVED")
        await tx.propertyMatch.updateMany({
          where: { itemId: id, active: true },
          data: { previousItemStatus: "IN_STORAGE" },
        });
      await tx.propertyCustodyEvent.create({
        data: {
          itemId: id,
          actorId: actor.id,
          kind: "TRANSFER",
          fromCustodianId: row.custodianId,
          toCustodianId: input.custodianId,
          fromLocation: row.storageLocation,
          toLocation: input.storageLocation,
        },
      });
    } else if (action === "return" && kind === "items") {
      office(actor);
      const input = z
        .object({
          recipientName: textField.max(200),
          verificationNotes: textField,
          collectedAt: z.iso.datetime({ offset: true }),
        })
        .parse(raw);
      if (new Date(input.collectedAt) > new Date())
        throw new WorkflowError("Collection time cannot be in the future");
      data.status = "RETURNED";
      await tx.propertyCustodyEvent.create({
        data: {
          itemId: id,
          actorId: actor.id,
          kind: "RETURN",
          fromCustodianId: row.custodianId,
          fromLocation: row.storageLocation,
          details: input,
        },
      });
      const match = await tx.propertyMatch.findFirst({ where: { itemId: id, active: true } });
      if (match) {
        await tx.lostPropertyReport.update({
          where: { id: match.reportId },
          data: { status: "RETURNED", version: { increment: 1 } },
        });
        await audit(tx, actor, "LostPropertyReport", match.reportId, "PROPERTY_RETURNED", {
          itemId: id,
        });
        const report = await tx.lostPropertyReport.findUnique({ where: { id: match.reportId } });
        await notify(
          tx,
          [report.reporterId, ...(report.ownerId ? [report.ownerId] : [])],
          "LostPropertyReport",
          report.id,
          "Property has been returned",
          href("reports", report.id),
        );
      }
    } else if (action === "dispose" && kind === "items") {
      if (!["ADMIN", "MANAGER"].includes(actor.role))
        throw new WorkflowError("Manager or administrator authorization is required", 403);
      if (row.status === "RESERVED")
        throw new WorkflowError("Release the match before disposal", 409);
      history.reason = textField.parse(raw.reason);
      data.status = "DISPOSED";
      await tx.propertyCustodyEvent.create({
        data: {
          itemId: id,
          actorId: actor.id,
          kind: "DISPOSE",
          fromCustodianId: row.custodianId,
          fromLocation: row.storageLocation,
          details: { reason: history.reason },
        },
      });
    } else throw new WorkflowError("Unknown property action");
    const updated = await tx[propertyModel(kind)].update({ where: { id }, data });
    await audit(tx, actor, propertyEntity(kind), id, `PROPERTY_${action.toUpperCase()}`, history);
    await notify(
      tx,
      [
        ...(await officeIds(tx)),
        row.reporterId,
        ...(updated.ownerId ? [updated.ownerId] : []),
        ...(updated.custodianId ? [updated.custodianId] : []),
      ],
      propertyEntity(kind),
      id,
      "A property record has been updated",
      href(kind, id),
    );
    return { success: true };
  });
}

export async function matchProperty(actor: EmployeeActor, raw: any) {
  office(actor);
  const input = z
    .object({
      reportId: positiveId,
      itemId: positiveId,
      reportVersion: positiveId,
      itemVersion: positiveId,
    })
    .parse(raw);
  return transaction(async (tx) => {
    const report = await propertyDetail("reports", input.reportId, actor, tx),
      item = await propertyDetail("items", input.itemId, actor, tx);
    checkVersion(report, input.reportVersion);
    checkVersion(item, input.itemVersion);
    if (report.status !== "OPEN" || !["FOUND", "IN_STORAGE"].includes(item.status))
      throw new WorkflowError("Only open reports and unreserved items can be matched", 409);
    const match = await tx.propertyMatch.create({
      data: {
        reportId: report.id,
        itemId: item.id,
        actorId: actor.id,
        previousItemStatus: item.status,
      },
    });
    await tx.lostPropertyReport.update({
      where: { id: report.id },
      data: { status: "MATCHED", version: { increment: 1 } },
    });
    await tx.foundPropertyItem.update({
      where: { id: item.id },
      data: { status: "RESERVED", version: { increment: 1 } },
    });
    for (const [kind, row] of [
      ["reports", report],
      ["items", item],
    ] as const) {
      await audit(tx, actor, propertyEntity(kind), row.id, "PROPERTY_MATCHED", {
        matchId: match.id,
      });
      await notify(
        tx,
        [...(await officeIds(tx)), row.reporterId, ...(row.ownerId ? [row.ownerId] : [])],
        propertyEntity(kind),
        row.id,
        "Property matched and awaiting collection",
        href(kind, row.id),
      );
    }
    return match;
  });
}

export async function releaseMatch(id: number, actor: EmployeeActor, raw: any) {
  office(actor);
  const reason = textField.parse(raw.reason);
  return transaction(async (tx) => {
    const match = await tx.propertyMatch.findUnique({
      where: { id },
      include: { report: true, item: true },
    });
    if (!match || !match.active || match.item.status !== "RESERVED")
      throw new WorkflowError("This match cannot be released", 409);
    checkVersion(match.report, positiveId.parse(raw.reportVersion));
    checkVersion(match.item, positiveId.parse(raw.itemVersion));
    await tx.propertyMatch.update({
      where: { id },
      data: { active: false, releaseReason: reason, releasedAt: new Date() },
    });
    await tx.lostPropertyReport.update({
      where: { id: match.reportId },
      data: { status: "OPEN", version: { increment: 1 } },
    });
    await tx.foundPropertyItem.update({
      where: { id: match.itemId },
      data: { status: match.previousItemStatus, version: { increment: 1 } },
    });
    for (const [kind, row] of [
      ["reports", match.report],
      ["items", match.item],
    ] as const) {
      await audit(tx, actor, propertyEntity(kind), row.id, "PROPERTY_MATCH_RELEASED", {
        matchId: id,
        reason,
      });
      await notify(
        tx,
        [...(await officeIds(tx)), row.reporterId, ...(row.ownerId ? [row.ownerId] : [])],
        propertyEntity(kind),
        row.id,
        "A property match has been released",
        href(kind, row.id),
      );
    }
    return { success: true };
  });
}
