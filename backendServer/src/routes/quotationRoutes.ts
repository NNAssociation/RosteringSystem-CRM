import { getAuth } from "@clerk/express";
import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { Webhook } from "svix";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireEmployee, requireOffice } from "../middleware/employeeAuth.js";
import { businessTimeZone, dateTime } from "../services/businessTime.js";
import { ResendProvider } from "../services/emailProviders/resend.js";
import { handleBrevoEvent } from "../services/emailService.js";
import { getTravelTime } from "../services/googleMapsService.js";
import { quotationPdf } from "../services/quotationDocument.js";
import * as quotes from "../services/quotationService.js";
export const quotationRouter = Router();
quotationRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store").set("Referrer-Policy", "no-referrer");
  next();
});
const getActor = (req: any) => {
  try {
    const auth = getAuth(req);
    return auth?.userId || req.staffId || "staff";
  } catch {
    return req.staffId || "staff";
  }
};
const action = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
  try {
    await fn(req, res);
  } catch (error: any) {
    res.status(error instanceof z.ZodError ? 400 : error.status || 500).json({
      error:
        error instanceof z.ZodError
          ? error.issues.map((i) => i.message).join(", ")
          : error.status
            ? error.message
            : "Unable to complete quotation request",
    });
  }
};
const id = (value: unknown) => z.coerce.number().int().positive().parse(value);
const equalSecret = (actual: string, expected: string) => {
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
quotationRouter.get(
  "/public/:token",
  action(async (req, res) => {
    res
      .set("Cache-Control", "no-store")
      .set("Referrer-Policy", "no-referrer")
      .json(quotes.safeQuotation(await quotes.publicQuotation(req.params.token), true));
  }),
);
quotationRouter.get(
  "/public/:token/pdf",
  action(async (req, res) => {
    const q = await quotes.publicQuotation(req.params.token);
    res
      .set("Cache-Control", "no-store")
      .type("pdf")
      .attachment(`quotation-${q.id}.pdf`)
      .send(await quotationPdf(q));
  }),
);
quotationRouter.post(
  "/public/:token/respond",
  action(async (req, res) => {
    const input = z
      .object({
        decision: z.enum(["ACCEPT", "DECLINE"]),
        name: z.string().trim().min(2).max(200),
        acceptTerms: z.boolean().optional(),
        reason: z.string().max(2000).optional(),
      })
      .parse(req.body);
    res
      .set("Cache-Control", "no-store")
      .json(await quotes.respondToQuotation(req.params.token, input));
  }),
);
quotationRouter.post(
  "/webhooks/brevo",
  action(async (req, res) => {
    const expected = process.env.BREVO_WEBHOOK_SECRET,
      actual = req.get("authorization") || "",
      wanted = `Bearer ${expected}`;
    if (!expected || !equalSecret(actual, wanted)) {
      res.status(401).json({ error: "Unauthorized webhook" });
      return;
    }
    await handleBrevoEvent(req.body);
    res.sendStatus(204);
  }),
);
quotationRouter.post(
  "/webhooks/resend",
  action(async (req, res) => {
    const expected = process.env.RESEND_WEBHOOK_SECRET;
    if (!expected) {
      res.status(503).json({ error: "Webhook is not configured" });
      return;
    }
    if (expected.startsWith("whsec_")) {
      try {
        req.body = new Webhook(expected).verify(req.rawBody, {
          "svix-id": req.get("svix-id") || "",
          "svix-timestamp": req.get("svix-timestamp") || "",
          "svix-signature": req.get("svix-signature") || "",
        });
      } catch {
        res.status(401).json({ error: "Unauthorized webhook" });
        return;
      }
    } else {
      const actual = req.get("authorization") || req.get("resend-signature") || "";
      const wanted = `Bearer ${expected}`;
      const matchesBearer = equalSecret(actual, wanted);
      const matchesDirect = equalSecret(actual, expected);
      if (!matchesBearer && !matchesDirect) {
        res.status(401).json({ error: "Unauthorized webhook" });
        return;
      }
    }
    await new ResendProvider().handleWebhookEvent(req.body);
    res.sendStatus(204);
  }),
);
quotationRouter.get("/healthz", (_req: any, res: any) =>
  res.json({ ok: true, routes: "quotations" }),
);
// Only capability links and authenticated provider webhooks are public.
quotationRouter.use(requireEmployee, requireOffice);
quotationRouter.get(
  "/config",
  action(async (_req, res) => {
    const { getCharterPricingConfig } = await import("../services/charterPricingService.js");
    const charterPricing = await getCharterPricingConfig();
    res.json({
      timeZone: businessTimeZone(),
      currency: process.env.QUOTATION_CURRENCY || "AUD",
      taxBasisPoints: Number(
        process.env.QUOTATION_TAX_BASIS_POINTS || charterPricing.gstPercent * 100 || 1000,
      ),
      validityDays: Number(process.env.QUOTATION_VALIDITY_DAYS || 14),
      emailConfigured: quotes.emailConfiguration(),
      defaultTerms: charterPricing.termsAndConditions,
      charterPricing,
    });
  }),
);
quotationRouter.post(
  "/calculate-charter",
  action(async (req, res) => {
    const { getCharterPricingConfig, calculateCharterPrice } =
      await import("../services/charterPricingService.js");
    const input = z
      .object({
        vehicleType: z.enum(["Coach", "Bus"]).default("Coach"),
        vehicleCount: z.number().int().min(1).max(50).default(1).optional(),
        distanceKm: z.number().min(0).max(5000),
        charterDate: z.string().optional(),
        startTime: z.string().optional(),
        finishTime: z.string().optional(),
        totalHours: z.number().optional(),
        manualAdjustment: z.number().optional(),
      })
      .parse(req.body);

    const config = await getCharterPricingConfig();
    res.json(calculateCharterPrice(config, input));
  }),
);
quotationRouter.post(
  "/deliveries/:id/retry",
  action(async (req, res) => {
    const input = z.object({ confirmedNotSent: z.boolean().optional() }).parse(req.body);
    const delivery = await prisma.emailDelivery.findUnique({
      where: { id: req.params.id },
      include: { quotation: true },
    });
    if (!delivery || !["FAILED", "BOUNCED", "BLOCKED", "UNKNOWN"].includes(delivery.status)) {
      res.status(409).json({ error: "This delivery is not eligible for retry" });
      return;
    }
    if (delivery.status === "UNKNOWN" && !input.confirmedNotSent) {
      res
        .status(409)
        .json({ error: "Check Brevo logs and confirm the message was not sent before retrying" });
      return;
    }
    if (
      delivery.kind === "QUOTATION" &&
      (delivery.quotation.status !== "SENT" || delivery.quotation.expiresAt <= new Date())
    ) {
      res.status(409).json({ error: "Create a new quotation revision before sending" });
      return;
    }
    const result = await prisma.$transaction(async (tx: any) => {
      const changed = await tx.emailDelivery.updateMany({
        where: { id: delivery.id, status: delivery.status, updatedAt: delivery.updatedAt },
        data: { status: "RETRIED" },
      });
      if (!changed.count) return false;
      await tx.emailDelivery.create({
        data: {
          quotationId: delivery.quotationId,
          recipient: delivery.recipient,
          kind: delivery.kind,
        },
      });
      await tx.activityLog.create({
        data: {
          entity: "Booking",
          entityId: delivery.quotation.bookingId,
          action: "EMAIL_RETRY_REQUESTED",
          changes: {
            deliveryId: delivery.id,
            actor: getActor(req),
            confirmedNotSent: !!input.confirmedNotSent,
          },
        },
      });
      return true;
    });
    res
      .status(result ? 200 : 409)
      .json(result ? { queued: true } : { error: "Delivery changed. Refresh and try again." });
  }),
);
quotationRouter.post(
  "/estimate-route",
  action(async (req, res) => {
    const point = z.object({
      address: z.string().min(1),
      lat: z.number().optional(),
      lng: z.number().optional(),
    });
    const input = z
      .object({
        points: z.array(point).min(2).max(22),
        date: z.string(),
        time: z.string(),
        timeZone: z.string().default("Australia/Sydney"),
      })
      .parse(req.body);
    const first = input.points[0];
    const last = input.points[input.points.length - 1];
    const travel =
      first?.lat != null && first?.lng != null && last?.lat != null && last?.lng != null
        ? await getTravelTime({ lat: first.lat, lng: first.lng }, { lat: last.lat, lng: last.lng })
        : { durationMinutes: 30, distanceKm: 15 };
    const drivingSeconds = travel.durationMinutes * 60;
    res.json({
      drivingDurationSeconds: drivingSeconds,
      distanceMeters: travel.distanceKm * 1000,
      durationMinutes: travel.durationMinutes,
      distanceKm: travel.distanceKm,
      estimatedEnd: new Date(
        dateTime(input.date, input.time, input.timeZone).getTime() + drivingSeconds * 1000,
      ).toISOString(),
      estimated: true,
    });
  }),
);
quotationRouter.get(
  "/booking/:id",
  action(async (req, res) => res.json(await quotes.listQuotations(id(req.params.id)))),
);
quotationRouter.get(
  "/booking/:id/activity",
  action(async (req, res) =>
    res.json(
      await prisma.activityLog.findMany({
        where: { entity: "Booking", entityId: id(req.params.id) },
        orderBy: { timestamp: "desc" },
        take: 100,
      }),
    ),
  ),
);
quotationRouter.post(
  "/booking/:id",
  action(async (req, res) => {
    const input = z
      .object({
        routeReview: z
          .object({ fingerprint: z.string().length(64), action: z.enum(["KEEP", "RECALCULATED"]) })
          .optional(),
        quoteEstimateId: z.number().int().positive().optional(),
        estimateOverrideReason: z.string().trim().min(10).max(4000).optional(),
        bookingRevision: z.number().int().positive(),
        previousQuotationId: z.number().nullable(),
        currency: z.enum(["AUD", "NZD", "USD", "GBP", "EUR"]),
        discountMinor: z.number().int().min(0),
        taxBasisPoints: z.number().int().min(0).max(10000),
        items: z
          .array(
            z.object({
              description: z.string().trim().min(1).max(500),
              quantity: z.number().int().min(1).max(10000),
              unitPriceMinor: z.number().int().min(0).max(1000000000),
            }),
          )
          .min(1)
          .max(100),
        expiresAt: z.string().datetime(),
        terms: z.string().max(10000),
        message: z.string().max(5000),
      })
      .parse(req.body);
    res.status(201).json(await quotes.saveQuotation(id(req.params.id), input, getActor(req)));
  }),
);
quotationRouter.post(
  "/:id/send",
  action(async (req, res) =>
    res.json(await quotes.sendQuotation(id(req.params.id), getActor(req))),
  ),
);
quotationRouter.post(
  "/booking/:id/amend",
  action(async (req, res) =>
    res.status(201).json(await quotes.createAmendment(id(req.params.id), getActor(req))),
  ),
);
quotationRouter.get(
  "/:id/pdf",
  action(async (req, res) => {
    const q = await prisma.quotation.findUnique({
      where: { id: id(req.params.id) },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!q) {
      res.sendStatus(404);
      return;
    }
    res
      .type("pdf")
      .attachment(`quotation-${q.id}.pdf`)
      .send(await quotationPdf(q));
  }),
);
quotationRouter.post(
  "/:id/record-acceptance",
  action(async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(200).optional(),
        reason: z.string().max(2000).optional(),
      })
      .parse(req.body);
    res.json(
      await quotes.staffRecordAcceptance(
        id(req.params.id),
        {
          name: input.name || "Customer Direct Approval",
          reason: input.reason || "Approved by customer",
        },
        getActor(req),
      ),
    );
  }),
);
