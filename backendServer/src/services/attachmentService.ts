import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import { isOffice, type EmployeeActor } from "../middleware/employeeAuth.js";
import { incidentDetail } from "./incidentService.js";
import { noticeDetail } from "./noticeService.js";
import { propertyDetail } from "./propertyService.js";
import { WorkflowError } from "./workflowError.js";
import { audit, office, positiveId, transaction } from "./workplaceCommon.js";

export const attachmentKeys = ["noticeId", "incidentId", "updateId", "reportId", "itemId"] as const;
export function detectFile(buffer: Buffer) {
  if (buffer.length > 10 * 1024 * 1024 || buffer.length < 4)
    throw new WorkflowError("Files must be between 4 bytes and 10 MB");
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  throw new WorkflowError("Only JPEG, PNG, WebP and PDF files are supported");
}
export function attachmentParent(raw: any) {
  const keys = attachmentKeys.filter((key) => raw[key] != null);
  if (keys.length !== 1) throw new WorkflowError("Exactly one attachment parent is required");
  return { [keys[0]!]: positiveId.parse(raw[keys[0]!]) };
}
export async function authorizeAttachment(
  parent: any,
  actor: EmployeeActor,
  write = false,
  db: any = prisma,
) {
  if (parent.noticeId) {
    if (process.env.NOTICES_ENABLED !== "true")
      throw new WorkflowError("Notice Board is disabled", 404);
    const row = await noticeDetail(parent.noticeId, actor, db);
    if (write) {
      office(actor);
      if (row.status === "ARCHIVED")
        throw new WorkflowError("Archived notices cannot be modified", 409);
    }
  } else if (parent.incidentId || parent.updateId) {
    if (process.env.INCIDENTS_ENABLED !== "true")
      throw new WorkflowError("Incidents are disabled", 404);
    let id = parent.incidentId;
    if (parent.updateId) {
      const update = await db.incidentUpdate.findUnique({ where: { id: parent.updateId } });
      if (!update || (update.officeOnly && !isOffice(actor)))
        throw new WorkflowError("Attachment not found", 404);
      if (write && !isOffice(actor) && update.authorId !== actor.id)
        throw new WorkflowError("Only the author can attach to this update", 403);
      id = update.incidentId;
    }
    const row = await incidentDetail(id, actor, db);
    if (write && row.status === "CLOSED")
      throw new WorkflowError("Reopen the incident before attaching files", 409);
  } else {
    if (process.env.LOST_PROPERTY_ENABLED !== "true")
      throw new WorkflowError("Lost Property is disabled", 404);
    const row = await propertyDetail(
      parent.reportId ? "reports" : "items",
      parent.reportId || parent.itemId,
      actor,
      db,
    );
    if (write && ["RETURNED", "DISPOSED", "CLOSED"].includes(row.status))
      throw new WorkflowError("This property record is final", 409);
  }
}
function storageConfig() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket = process.env.SUPABASE_WORKPLACE_BUCKET;
  if (!url || !key || !bucket)
    throw new WorkflowError("Private attachment storage is not configured", 503);
  return { url: url.replace(/\/$/, ""), key, bucket };
}
async function storage(method: string, key: string, body?: Buffer, mimeType?: string) {
  const config = storageConfig();
  const headers = { apikey: config.key, Authorization: `Bearer ${config.key}` };
  if (method !== "DELETE") {
    const bucketResponse = await fetch(
      `${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (!bucketResponse.ok || (await bucketResponse.json()).public !== false)
      throw new WorkflowError("Attachment storage must be a private bucket", 503);
  }
  const deleting = method === "DELETE";
  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}${deleting ? "" : `/${key.split("/").map(encodeURIComponent).join("/")}`}`,
    {
      method,
      headers: {
        ...headers,
        ...(deleting
          ? { "Content-Type": "application/json" }
          : mimeType
            ? { "Content-Type": mimeType }
            : {}),
      },
      ...(deleting
        ? { body: JSON.stringify({ prefixes: [key] }) }
        : body
          ? { body: new Uint8Array(body) }
          : {}),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok && !(method === "DELETE" && response.status === 404))
    throw new WorkflowError("Private file storage is unavailable. Try again.", 503);
  return response;
}
export async function listAttachments(parent: any, actor: EmployeeActor) {
  await authorizeAttachment(parent, actor);
  return prisma.attachment.findMany({
    where: { ...parent, state: "READY" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      uploaderId: true,
      createdAt: true,
    },
  });
}
export async function uploadAttachment(
  raw: any,
  actor: EmployeeActor,
  body: Buffer,
  filename: string,
) {
  storageConfig();
  const parent = attachmentParent(raw),
    mimeType = detectFile(body);
  const id = randomUUID(),
    storageKey = `workplace/${id}`;
  const row = await transaction(async (tx) => {
    await authorizeAttachment(parent, actor, true, tx);
    if (
      (await tx.attachment.count({ where: { ...parent, state: { in: ["READY", "PENDING"] } } })) >=
      10
    )
      throw new WorkflowError("A record may have at most ten attachments");
    return tx.attachment.create({
      data: {
        id,
        ...parent,
        storageKey,
        filename: filename.replace(/[\r\n/\\]/g, "_").slice(0, 180) || "attachment",
        mimeType,
        size: body.length,
        uploaderId: actor.id,
      },
    });
  });
  try {
    await storage("POST", storageKey, body, mimeType);
    await transaction(async (tx) => {
      await authorizeAttachment(parent, actor, true, tx);
      await tx.attachment.update({ where: { id }, data: { state: "READY" } });
      await audit(
        tx,
        actor,
        "Attachment",
        Object.values(parent)[0] as number,
        "ATTACHMENT_UPLOADED",
        { attachmentId: id },
      );
    });
    return { id: row.id, filename: row.filename };
  } catch (e) {
    await prisma.attachment.update({ where: { id }, data: { state: "DELETE_PENDING" } });
    throw e;
  }
}
export async function downloadAttachment(id: string, actor: EmployeeActor) {
  const row = await prisma.attachment.findUnique({ where: { id } });
  if (!row || row.state !== "READY") throw new WorkflowError("Attachment not found", 404);
  await authorizeAttachment(row, actor);
  const response = await storage("GET", row.storageKey);
  return { row, bytes: Buffer.from(await response.arrayBuffer()) };
}
export async function removeAttachment(id: string, actor: EmployeeActor) {
  await transaction(async (tx) => {
    const row = await tx.attachment.findUnique({ where: { id } });
    if (!row || row.state !== "READY") throw new WorkflowError("Attachment not found", 404);
    await authorizeAttachment(row, actor, true, tx);
    if (!isOffice(actor) && row.uploaderId !== actor.id)
      throw new WorkflowError("Only the uploader or office staff can remove this file", 403);
    await tx.attachment.update({ where: { id }, data: { state: "DELETE_PENDING" } });
    await audit(tx, actor, "Attachment", 0, "ATTACHMENT_REMOVED", { attachmentId: id });
  });
}
export async function cleanupAttachments() {
  if (!process.env.SUPABASE_WORKPLACE_BUCKET) return;
  const rows = await prisma.attachment.findMany({
    where: {
      OR: [
        { state: "DELETE_PENDING" },
        { state: "PENDING", createdAt: { lt: new Date(Date.now() - 3600000) } },
      ],
    },
    take: 100,
  });
  for (const row of rows) {
    await storage("DELETE", row.storageKey);
    await prisma.attachment.delete({ where: { id: row.id } });
  }
}
