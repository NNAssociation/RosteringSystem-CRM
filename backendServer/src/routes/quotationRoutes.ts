import { Router } from "express";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { requireStaff } from "../middleware/staffAuth.js";
import { prisma } from "../db.js";
import * as quotes from "../services/quotationService.js";
import { quotationPdf } from "../services/quotationDocument.js";
import { handleBrevoEvent } from "../services/emailService.js";
import { businessTimeZone, dateTime } from "../services/businessTime.js";
import { getTravelTime } from "../services/googleMapsService.js";
export const quotationRouter = Router();
const action = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
  try { await fn(req, res); } catch (error: any) {
    res.status(error instanceof z.ZodError ? 400 : error.status || 500).json({ error: error instanceof z.ZodError ? error.issues.map(i => i.message).join(", ") : error.status ? error.message : "Unable to complete quotation request" });
  }
};
const id = (value: unknown) => z.coerce.number().int().positive().parse(value);
quotationRouter.get("/public/:token", action(async (req, res) => { res.set("Cache-Control", "no-store").set("Referrer-Policy", "no-referrer").json(quotes.safeQuotation(await quotes.publicQuotation(req.params.token), true)); }));
quotationRouter.get("/public/:token/pdf", action(async (req, res) => {
  const q = await quotes.publicQuotation(req.params.token);
  res.set("Cache-Control", "no-store").type("pdf").attachment(`quotation-${q.id}.pdf`).send(await quotationPdf(q));
}));
quotationRouter.post("/public/:token/respond", action(async (req, res) => {
  const input = z.object({ decision: z.enum(["ACCEPT", "DECLINE"]), name: z.string().trim().min(2).max(200), acceptTerms: z.boolean().optional(), reason: z.string().max(2000).optional() }).parse(req.body);
  res.set("Cache-Control", "no-store").json(await quotes.respondToQuotation(req.params.token, input));
}));
quotationRouter.post("/webhooks/brevo", action(async (req, res) => {
  const expected = process.env.BREVO_WEBHOOK_SECRET, actual = req.get("authorization") || "", wanted = `Bearer ${expected}`;
  if (!expected || actual.length !== wanted.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(wanted))) { res.status(401).json({ error: "Unauthorized webhook" }); return; }
  await handleBrevoEvent(req.body); res.sendStatus(204);
}));
quotationRouter.post("/webhooks/resend", action(async (req, res) => {
  const expected = process.env.RESEND_WEBHOOK_SECRET;
  if (expected) {
    const actual = req.get("authorization") || req.get("resend-signature") || "";
    const wanted = `Bearer ${expected}`;
    const matchesBearer = actual.length === wanted.length && timingSafeEqual(Buffer.from(actual), Buffer.from(wanted));
    const matchesDirect = actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
    if (!matchesBearer && !matchesDirect) { res.status(401).json({ error: "Unauthorized webhook" }); return; }
  }
  const { getEmailProvider } = await import("../services/emailProviders/index.js");
  const provider = getEmailProvider();
  if (provider.handleWebhookEvent) await provider.handleWebhookEvent(req.body);
  res.sendStatus(204);
}));
quotationRouter.get("/healthz", (_req: any, res: any) => res.json({ ok: true, routes: "quotations" }));
quotationRouter.use(requireStaff);
quotationRouter.post("/deliveries/:id/retry", action(async (req, res) => {
  const input = z.object({ confirmedNotSent: z.boolean().optional() }).parse(req.body);
  const delivery = await prisma.emailDelivery.findUnique({ where: { id: req.params.id }, include: { quotation: true } });
  if (!delivery || !["FAILED", "BOUNCED", "BLOCKED", "UNKNOWN"].includes(delivery.status)) { res.status(409).json({ error: "This delivery is not eligible for retry" }); return; }
  if (delivery.status === "UNKNOWN" && !input.confirmedNotSent) { res.status(409).json({ error: "Check Brevo logs and confirm the message was not sent before retrying" }); return; }
  if (delivery.kind === "QUOTATION" && (delivery.quotation.status !== "SENT" || delivery.quotation.expiresAt <= new Date())) { res.status(409).json({ error: "Create a new quotation revision before sending" }); return; }
  const result = await prisma.$transaction(async (tx: any) => {
    const changed = await tx.emailDelivery.updateMany({ where: { id: delivery.id, status: delivery.status, updatedAt: delivery.updatedAt }, data: { status: "RETRIED" } });
    if (!changed.count) return false;
    await tx.emailDelivery.create({ data: { quotationId: delivery.quotationId, recipient: delivery.recipient, kind: delivery.kind } });
    await tx.activityLog.create({ data: { entity: "Booking", entityId: delivery.quotation.bookingId, action: "EMAIL_RETRY_REQUESTED", changes: { deliveryId: delivery.id, actor: req.staffId, confirmedNotSent: !!input.confirmedNotSent } } });
    return true;
  });
  res.status(result ? 200 : 409).json(result ? { queued: true } : { error: "Delivery changed. Refresh and try again." });
}));
quotationRouter.post("/estimate-route", action(async (req, res) => {
  const point = z.object({ address: z.string().min(1), lat: z.number().optional(), lng: z.number().optional() });
  const input = z.object({ points: z.array(point).min(2).max(22), date: z.string(), time: z.string(), timeZone: z.string() }).parse(req.body);
  let durationMinutes = 0, distanceKm = 0;
  const location = (p: z.infer<typeof point>) => p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : p.address;
  for (let i = 1; i < input.points.length; i++) {
    const leg = await getTravelTime(location(input.points[i - 1]!), location(input.points[i]!));
    durationMinutes += leg.durationMinutes; distanceKm += leg.distanceKm;
  }
  res.json({ durationMinutes, distanceKm: Math.round(distanceKm * 10) / 10, estimatedEnd: new Date(dateTime(input.date, input.time, input.timeZone).getTime() + durationMinutes * 60000).toISOString(), estimated: true });
}));
quotationRouter.get("/config", action(async (_req, res) => res.json({ timeZone: businessTimeZone(), currency: process.env.QUOTATION_CURRENCY || "AUD", taxBasisPoints: Number(process.env.QUOTATION_TAX_BASIS_POINTS || 0), validityDays: Number(process.env.QUOTATION_VALIDITY_DAYS || 14), emailConfigured: quotes.emailConfiguration() })));
quotationRouter.get("/booking/:id", action(async (req, res) => res.json(await quotes.listQuotations(id(req.params.id)))));
quotationRouter.get("/booking/:id/activity", action(async (req, res) => res.json(await prisma.activityLog.findMany({ where: { entity: "Booking", entityId: id(req.params.id) }, orderBy: { timestamp: "desc" }, take: 100 }))));
quotationRouter.post("/booking/:id", action(async (req, res) => {
  const input = z.object({ bookingRevision: z.number().int().positive(), previousQuotationId: z.number().nullable(), currency: z.enum(["AUD", "NZD", "USD", "GBP", "EUR"]), discountMinor: z.number().int().min(0), taxBasisPoints: z.number().int().min(0).max(10000), items: z.array(z.object({ description: z.string().trim().min(1).max(500), quantity: z.number().int().min(1).max(10000), unitPriceMinor: z.number().int().min(0).max(1000000000) })).min(1).max(100), expiresAt: z.string().datetime(), terms: z.string().max(10000), message: z.string().max(5000) }).parse(req.body);
  res.status(201).json(await quotes.saveQuotation(id(req.params.id), input, req.staffId));
}));
quotationRouter.post("/:id/send", action(async (req, res) => res.json(await quotes.sendQuotation(id(req.params.id), req.staffId))));
quotationRouter.post("/booking/:id/amend", action(async (req, res) => res.status(201).json(await quotes.createAmendment(id(req.params.id), req.staffId))));
quotationRouter.get("/:id/pdf", action(async (req, res) => {
  const q = await prisma.quotation.findUnique({ where: { id: id(req.params.id) }, include: { items: { orderBy: { position: "asc" } } } });
  if (!q) { res.sendStatus(404); return; }
  res.type("pdf").attachment(`quotation-${q.id}.pdf`).send(await quotationPdf(q));
}));
