import { randomBytes, createHash, createCipheriv, createDecipheriv } from "node:crypto";
import { prisma } from "../db.js";
import { cancelBookingAssignments } from "./assignmentService.js";
import { quotationTotals } from "./quotationMath.js";
import { buildJobs } from "./bookingWorkflow.js";
import { WorkflowError } from "./workflowError.js";
import { getEmailProvider } from "./emailProviders/index.js";

const include = { items: { orderBy: { position: "asc" } }, deliveries: { orderBy: { createdAt: "desc" } } };
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
function encryptionKey() {
  const raw = process.env.QUOTATION_TOKEN_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new WorkflowError("Configure QUOTATION_TOKEN_KEY before sending email", 503);
  return Buffer.from(raw, "hex");
}
function encrypt(token: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
export function decryptToken(value: string) {
  const raw = Buffer.from(value, "base64"), cipher = createDecipheriv("aes-256-gcm", encryptionKey(), raw.subarray(0, 12));
  cipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString("utf8");
}
export function safeQuotation(q: any, publicView = false) {
  const { tokenHash, tokenCipher, deliveries, ...safe } = q;
  const status = q.status === "SENT" && new Date(q.expiresAt) < new Date() ? "EXPIRED" : q.status;
  return { ...safe, status, ...(publicView ? {} : { deliveries }) };
}
export async function listQuotations(bookingId: number) {
  return (await prisma.quotation.findMany({ where: { bookingId }, include, orderBy: { revision: "desc" } })).map((q: any) => safeQuotation(q));
}
export async function saveQuotation(bookingId: number, input: any, actor: string) {
  const totals = quotationTotals(input.items, input.discountMinor, input.taxBasisPoints);
  const expiresAt = new Date(input.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new WorkflowError("Choose a future quotation expiry");
  return prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const b = await tx.booking.findUnique({ where: { id: bookingId }, include: { customer: true } });
    if (!b) throw new WorkflowError("Booking not found", 404);
    if (["CONFIRMED", "CANCELLED", "SUPERSEDED"].includes(b.status)) throw new WorkflowError("Create an amendment for this booking", 409);
    if (input.bookingRevision !== b.revision) throw new WorkflowError("Trip details changed. Reload before saving the quotation.", 409);
    const jobs = buildJobs(b);
    if (jobs.some(j => j.jobStartDateTime <= new Date())) throw new WorkflowError("All quoted trips must be in the future");
    const previous = await tx.quotation.findFirst({ where: { bookingId }, orderBy: { revision: "desc" } });
    if ((input.previousQuotationId ?? null) !== (previous?.id ?? null)) throw new WorkflowError("Another user changed this quotation. Reload.", 409);
    await tx.quotation.updateMany({ where: { bookingId, status: { in: ["DRAFT", "SENT"] } }, data: { status: "SUPERSEDED", tokenHash: null, tokenCipher: null } });
    await tx.emailDelivery.updateMany({ where: { quotation: { bookingId }, status: "QUEUED" }, data: { status: "CANCELLED" } });
    const snapshot = { bookingId, subject: b.subject, customerName: b.customer.name, customerEmail: b.customer.email,
      startLocation: b.startLocation, endLocation: b.endLocation, stops: b.stops || [], startDateTime: b.startDateTime.toISOString(),
      endDateTime: b.endDateTime.toISOString(), returnDateTime: b.returnDateTime?.toISOString(), bookingType: b.bookingType,
      timeZone: b.timeZone, passengerCount: b.passengerCount, noOfVehicles: b.noOfVehicles, recurrenceRule: b.recurrenceRule,
      tripCount: jobs.length, companyName: process.env.COMPANY_NAME || "Transport Services" };
    const q = await tx.quotation.create({ data: { bookingId, revision: (previous?.revision || 0) + 1, currency: input.currency,
      discountMinor: input.discountMinor, taxBasisPoints: input.taxBasisPoints, subtotalMinor: totals.subtotalMinor,
      taxMinor: totals.taxMinor, totalMinor: totals.totalMinor, terms: input.terms, message: input.message,
      expiresAt, snapshot: JSON.parse(JSON.stringify(snapshot)), items: { create: totals.items } }, include });
    await tx.booking.update({ where: { id: bookingId }, data: { status: "DRAFT" } });
    await tx.activityLog.create({ data: { entity: "Booking", entityId: bookingId, action: "QUOTATION_CREATED", changes: { quotationId: q.id, actor } } });
    return safeQuotation(q);
  });
}
export function emailConfiguration() {
  const provider = getEmailProvider();
  return !!(provider.isConfigured() && process.env.PUBLIC_APP_URL && /^[a-f0-9]{64}$/i.test(process.env.QUOTATION_TOKEN_KEY || ""));
}
export async function sendQuotation(id: number, actor: string) {
  if (!emailConfiguration()) throw new WorkflowError("Email setup is incomplete. Configure Brevo, sender, public app URL and token encryption key.", 503);
  const appUrl = new URL(process.env.PUBLIC_APP_URL!);
  if (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:") throw new WorkflowError("Public app URL must use HTTPS", 503);
  return prisma.$transaction(async (tx: any) => {
    const lookup = await tx.quotation.findUnique({ where: { id } });
    if (!lookup) throw new WorkflowError("Quotation not found", 404);
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${lookup.bookingId} FOR UPDATE`;
    const q = await tx.quotation.findUnique({ where: { id }, include });
    if (!["DRAFT", "SENT"].includes(q.status) || q.expiresAt <= new Date()) throw new WorkflowError("This quotation cannot be sent. Create a new revision.", 409);
    const latest = q.deliveries[0];
    if (latest && !["FAILED", "BOUNCED", "BLOCKED"].includes(latest.status)) return safeQuotation(q);
    const token = q.tokenCipher ? decryptToken(q.tokenCipher) : randomBytes(32).toString("base64url");
    await tx.quotation.update({ where: { id }, data: { status: "SENT", sentAt: q.sentAt || new Date(), tokenHash: hashToken(token), tokenCipher: encrypt(token) } });
    await tx.emailDelivery.create({ data: { quotationId: id, recipient: q.snapshot.customerEmail } });
    await tx.booking.update({ where: { id: q.bookingId }, data: { status: "AWAITING_RESPONSE" } });
    await tx.activityLog.create({ data: { entity: "Booking", entityId: q.bookingId, action: "QUOTATION_QUEUED", changes: { quotationId: id, actor } } });
    return safeQuotation(await tx.quotation.findUnique({ where: { id }, include }));
  });
}
export async function publicQuotation(token: string, db = prisma) {
  if (!/^[\w-]{43}$/.test(token)) throw new WorkflowError("This quotation link is invalid or has been replaced", 404);
  const q = await db.quotation.findUnique({ where: { tokenHash: hashToken(token) }, include: { items: { orderBy: { position: "asc" } }, booking: { select: { status: true } } } });
  if (!q) throw new WorkflowError("This quotation link is invalid or has been replaced", 404);
  return q;
}
export async function respondToQuotation(token: string, input: any) {
  const lookup = await publicQuotation(token);
  return prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${lookup.bookingId} FOR UPDATE`;
    const q = await publicQuotation(token, tx);
    const next = input.decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
    if (q.status === next) return safeQuotation(q, true);
    if (q.status !== "SENT" || q.expiresAt <= new Date()) throw new WorkflowError("This quotation is expired, replaced or already answered", 409);
    const booking = await tx.booking.findUnique({ where: { id: q.bookingId } });
    if (booking.status !== "AWAITING_RESPONSE") throw new WorkflowError("Booking is no longer awaiting confirmation", 409);
    if (next === "ACCEPTED") {
      if (!input.acceptTerms) throw new WorkflowError("Please accept the quotation terms");
      const jobs = buildJobs(booking);
      if (jobs.some(j => j.jobStartDateTime <= new Date())) throw new WorkflowError("A quoted trip has already started. Please contact the bookings team.", 409);
      if (booking.amendsBookingId) {
        const parent = await tx.booking.findUnique({ where: { id: booking.amendsBookingId } });
        if (parent?.status !== "CONFIRMED") throw new WorkflowError("The original booking changed. Please contact the bookings team.", 409);
        if (await tx.assignment.count({ where: { job: { bookingId: parent.id }, status: { in: ["IN_PROGRESS", "COMPLETED"] } } })) throw new WorkflowError("The original trip has started; this amendment needs staff review", 409);
        await cancelBookingAssignments(tx, parent.id);
        await tx.job.updateMany({ where: { bookingId: parent.id }, data: { status: "CANCELLED" } });
        await tx.booking.update({ where: { id: parent.id }, data: { status: "SUPERSEDED" } });
      }
      // Old unconfirmed jobs may exist from before the workflow migration.
      await tx.job.updateMany({ where: { bookingId: booking.id }, data: { status: "CANCELLED" } });
      await tx.job.createMany({ data: jobs });
      await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", confirmedAt: new Date(), confirmationSource: "CUSTOMER_ACCEPTANCE" } });
    } else await tx.booking.update({ where: { id: booking.id }, data: { status: "DECLINED" } });
    const updated = await tx.quotation.update({ where: { id: q.id }, data: { status: next, respondedAt: new Date(), respondentName: input.name, responseReason: input.reason || "" }, include: { items: true } });
    await tx.activityLog.create({ data: { entity: "Booking", entityId: booking.id, action: `QUOTATION_${next}`, changes: { quotationId: q.id, name: input.name, reason: input.reason || "" } } });
    await tx.workflowEvent.create({ data: { type: "job.updated", payload: { bookingId: booking.id } } });
    await tx.emailDelivery.create({ data: { quotationId: q.id, recipient: q.snapshot.customerEmail, kind: "RESPONSE" } });
    return safeQuotation(updated, true);
  }, { maxWait: 15000, timeout: 60000 });
}
export async function createAmendment(id: number, actor: string) {
  return prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
    const b = await tx.booking.findUnique({ where: { id } });
    if (b?.status !== "CONFIRMED") throw new WorkflowError("Only confirmed bookings can be amended", 409);
    const pending = await tx.booking.findFirst({ where: { amendsBookingId: id, status: { in: ["DRAFT", "AWAITING_RESPONSE"] } } });
    if (pending) return { id: pending.id };
    const { id: oldId, createdAt, updatedAt, confirmedAt, confirmationSource, revision, ...data } = b;
    const result = await tx.booking.create({ data: { ...data, amendsBookingId: id, status: "DRAFT" } });
    await tx.activityLog.create({ data: { entity: "Booking", entityId: result.id, action: "AMENDMENT_CREATED", changes: { originalBookingId: id, actor } } });
    return { id: result.id };
  });
}
