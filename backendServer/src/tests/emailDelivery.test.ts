import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ workflowEvent: { findMany: vi.fn(), update: vi.fn() }, emailDelivery: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, quotation: { findUnique: vi.fn() } }));
vi.mock("../db.js", () => ({ prisma: db }));
vi.mock("../services/quotationService.js", () => ({ decryptToken: () => "a".repeat(43) }));
vi.mock("../services/quotationDocument.js", () => ({ quotationEmail: () => "<p>Quotation</p>", quotationPdf: async () => Buffer.from("%PDF-test") }));
const { processWorkflowOutbox, handleBrevoEvent } = await import("../services/emailService.js");
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("BREVO_API_KEY", "test-only"); vi.stubEnv("BREVO_SENDER_EMAIL", "sender@example.test"); vi.stubEnv("PUBLIC_APP_URL", "https://example.test");
  db.workflowEvent.findMany.mockResolvedValue([]); db.emailDelivery.findMany.mockResolvedValue([{ id: "delivery-1", quotationId: 1, kind: "QUOTATION", recipient: "customer@example.test", attempts: 0 }]); db.emailDelivery.updateMany.mockResolvedValue({ count: 1 });
  db.quotation.findUnique.mockResolvedValue({ id: 1, status: "SENT", expiresAt: new Date("2030-01-01"), snapshot: { subject: "Trip" }, tokenCipher: "encrypted" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ messageId: "provider-1" }) }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Durable email delivery", () => {
  it("claims a queued email and records the provider receipt", async () => { await processWorkflowOutbox(); expect(fetch).toHaveBeenCalledTimes(1); expect(db.emailDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SENT", providerMessageId: "provider-1" }) })); });
  it("does not send if another worker already claimed the email", async () => { db.emailDelivery.updateMany.mockResolvedValue({ count: 0 }); await processWorkflowOutbox(); expect(fetch).not.toHaveBeenCalled(); });
  it("does not send a replaced or expired quotation", async () => { db.quotation.findUnique.mockResolvedValue({ status: "SUPERSEDED", expiresAt: new Date(0) }); await processWorkflowOutbox(); expect(fetch).not.toHaveBeenCalled(); expect(db.emailDelivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELLED" } })); });
  it("retries explicit rate limiting with backoff", async () => { vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429, json: async () => ({ code: "rate_limit" }) } as Response); await processWorkflowOutbox(); expect(db.emailDelivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "QUEUED" }) })); });
  it("does not blindly retry an ambiguous network failure", async () => { vi.mocked(fetch).mockRejectedValue(new Error("timeout")); await processWorkflowOutbox(); expect(db.emailDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "UNKNOWN" }) })); });
  it("does not downgrade delivered emails when delayed events arrive", async () => { db.emailDelivery.findFirst.mockResolvedValue({ id: "delivery-1", recipient: "customer@example.test", status: "DELIVERED" }); await handleBrevoEvent({ event: "request", email: "customer@example.test", "message-id": "provider-1", ts_event: 1900000000 }); expect(db.emailDelivery.updateMany).not.toHaveBeenCalled(); });
  it("rejects webhook recipient mismatches", async () => { db.emailDelivery.findFirst.mockResolvedValue({ id: "delivery-1", recipient: "customer@example.test", status: "SENT" }); await handleBrevoEvent({ event: "delivered", email: "someone-else@example.test", "message-id": "provider-1", ts_event: 1900000000 }); expect(db.emailDelivery.updateMany).not.toHaveBeenCalled(); });
  it("records delivery without treating it as quotation acceptance", async () => { db.emailDelivery.findFirst.mockResolvedValue({ id: "delivery-1", recipient: "customer@example.test", status: "SENT" }); await handleBrevoEvent({ event: "delivered", email: "customer@example.test", "message-id": "provider-1", ts_event: 1900000000 }); expect(db.emailDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DELIVERED" }) })); expect(db.quotation.findUnique).not.toHaveBeenCalled(); });
});
