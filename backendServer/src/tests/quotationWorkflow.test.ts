import { beforeEach, describe, expect, it, vi } from "vitest";
import { quotationTotals } from "../services/quotationMath.js";
import { bookingData, buildJobs } from "../services/bookingWorkflow.js";
import { boardWindow, dateTime } from "../services/businessTime.js";
import { quotationPdf, quotationEmail } from "../services/quotationDocument.js";

const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(), $executeRaw: vi.fn(), quotation: { findUnique: vi.fn(), update: vi.fn() }, booking: { findUnique: vi.fn(), update: vi.fn() }, job: { createMany: vi.fn(), updateMany: vi.fn() }, assignment: { count: vi.fn(), updateMany: vi.fn() }, workflowEvent: { create: vi.fn() }, activityLog: { create: vi.fn() }, emailDelivery: { create: vi.fn() } }));
vi.mock("../db.js", () => ({ prisma: db }));
const { respondToQuotation, publicQuotation, hashToken, safeQuotation } = await import("../services/quotationService.js");
const token = "a".repeat(43);
const trip = () => ({ id: 1, subject: "Airport transfer", bookingType: "one_way", status: "AWAITING_RESPONSE", startDateTime: dateTime("2030-10-01", "09:00"), endDateTime: dateTime("2030-10-01", "10:00"), startLocation: "Sydney", endLocation: "Airport", timeZone: "Australia/Sydney", passengerCount: 12, noOfVehicles: 1 });
const quote = () => ({ id: 4, bookingId: 1, status: "SENT", tokenHash: hashToken(token), tokenCipher: "secret", expiresAt: new Date("2030-10-01T00:00:00Z"), snapshot: { customerEmail: "customer@example.test" }, items: [] });
beforeEach(() => { vi.clearAllMocks(); db.$transaction.mockImplementation(fn => fn(db)); db.booking.findUnique.mockResolvedValue(trip()); db.quotation.findUnique.mockResolvedValue(quote()); db.assignment.count.mockResolvedValue(0); db.quotation.update.mockImplementation(({ data }) => ({ ...quote(), ...data })); });

describe("Quotation arithmetic", () => {
  it("calculates discount before tax using integer cents", () => {
    expect(quotationTotals([{ description: "Trip", quantity: 3, unitPriceMinor: 10001 }], 1000, 1000)).toMatchObject({ subtotalMinor: 30003, taxMinor: 2900, totalMinor: 31903 });
  });
  it.each([-1, 10001, 0.5])("rejects invalid discount %s", discount => expect(() => quotationTotals([{ description: "Trip", quantity: 1, unitPriceMinor: 10000 }], discount, 0)).toThrow());
  it("rejects excessive totals and fractional quantities", () => {
    expect(() => quotationTotals([{ description: "Trip", quantity: 10000, unitPriceMinor: 1000000000 }], 0, 0)).toThrow();
    expect(() => quotationTotals([{ description: "Trip", quantity: 1.5, unitPriceMinor: 100 }], 0, 0)).toThrow();
  });
});
describe("Australian trip dates", () => {
  it("uses a 23-hour dispatch day when Sydney daylight saving begins", () => { const w = boardWindow("2026-10-04"); expect((w.end.getTime() - w.start.getTime()) / 3600000).toBe(23); });
  it("uses a 25-hour dispatch day when daylight saving ends", () => { const w = boardWindow("2026-04-05"); expect((w.end.getTime() - w.start.getTime()) / 3600000).toBe(25); });
  it("rejects nonexistent local clock times", () => expect(() => dateTime("2026-10-04", "02:30")).toThrow());
  it("creates recurring trips at the same local time across daylight saving", () => {
    const b = { ...trip(), bookingType: "repeatable", startDateTime: dateTime("2026-10-03", "09:00"), endDateTime: dateTime("2026-10-03", "10:00"), recurrenceRule: { type: "daily", startDate: "2026-10-03", endDate: "2026-10-05" } };
    const jobs = buildJobs(b); expect(jobs).toHaveLength(3); expect(jobs[1]!.jobStartDateTime.getTime() - jobs[0]!.jobStartDateTime.getTime()).toBe(23 * 3600000);
  });
  it("creates outbound and return legs with reversed locations", () => { const jobs = buildJobs({ ...trip(), bookingType: "round_trip", returnDateTime: dateTime("2030-10-01", "14:00") }); expect(jobs).toHaveLength(2); expect(jobs[1]!.jobStartLocation).toBe("Airport"); });
  it("rejects reverse time windows and incomplete recurring rules", () => {
    expect(() => bookingData({ date: "2030-01-01", startTime: "12:00", endTime: "11:00" })).toThrow();
    expect(() => buildJobs({ ...trip(), bookingType: "repeatable", recurrenceRule: { type: "weekly", days: [], startDate: "2030-01-01", endDate: "2030-02-01" } })).toThrow();
  });
});
describe("Customer acceptance", () => {
  it("atomically confirms, creates jobs, records audit and queues notification", async () => {
    const result = await respondToQuotation(token, { decision: "ACCEPT", name: "Customer", acceptTerms: true });
    expect(result.status).toBe("ACCEPTED"); expect(db.job.createMany).toHaveBeenCalledTimes(1);
    expect(db.booking.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CONFIRMED", confirmationSource: "CUSTOMER_ACCEPTANCE" }) }));
    expect(db.workflowEvent.create).toHaveBeenCalledTimes(1); expect(db.emailDelivery.create).toHaveBeenCalledTimes(1);
  });
  it("does not duplicate jobs for repeat acceptance", async () => { db.quotation.findUnique.mockResolvedValue({ ...quote(), status: "ACCEPTED" }); expect((await respondToQuotation(token, { decision: "ACCEPT", name: "Customer", acceptTerms: true })).status).toBe("ACCEPTED"); expect(db.job.createMany).not.toHaveBeenCalled(); });
  it.each(["DECLINED", "SUPERSEDED", "WITHDRAWN"])("cannot accept a %s quotation", async status => { db.quotation.findUnique.mockResolvedValue({ ...quote(), status }); await expect(respondToQuotation(token, { decision: "ACCEPT", name: "Customer", acceptTerms: true })).rejects.toThrow(); expect(db.job.createMany).not.toHaveBeenCalled(); });
  it("cannot accept an expired quotation", async () => { db.quotation.findUnique.mockResolvedValue({ ...quote(), expiresAt: new Date(0) }); await expect(respondToQuotation(token, { decision: "ACCEPT", name: "Customer", acceptTerms: true })).rejects.toThrow(); });
  it("requires explicit acceptance of terms", async () => { await expect(respondToQuotation(token, { decision: "ACCEPT", name: "Customer" })).rejects.toThrow("terms"); expect(db.job.createMany).not.toHaveBeenCalled(); });
  it("records decline without creating jobs", async () => { await respondToQuotation(token, { decision: "DECLINE", name: "Customer", reason: "Date changed" }); expect(db.job.createMany).not.toHaveBeenCalled(); expect(db.booking.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: "DECLINED" } }); });
  it("does not mutate when an email link is opened", async () => { await publicQuotation(token); expect(db.quotation.update).not.toHaveBeenCalled(); expect(db.booking.update).not.toHaveBeenCalled(); });
  it("rejects malformed links and hides token material", async () => { await expect(publicQuotation("bad")).rejects.toThrow(); expect(safeQuotation(quote(), true)).not.toHaveProperty("tokenHash"); expect(safeQuotation(quote(), true)).not.toHaveProperty("tokenCipher"); });
  it("blocks amendment acceptance if original trips have started", async () => { db.booking.findUnique.mockResolvedValueOnce({ ...trip(), amendsBookingId: 2 }).mockResolvedValueOnce({ id: 2, status: "CONFIRMED" }); db.assignment.count.mockResolvedValue(1); await expect(respondToQuotation(token, { decision: "ACCEPT", name: "Customer", acceptTerms: true })).rejects.toThrow("started"); expect(db.job.createMany).not.toHaveBeenCalled(); });
});
describe("Customer documents", () => {
  const document = () => ({ ...quote(), revision: 1, currency: "AUD", discountMinor: 0, taxBasisPoints: 0, subtotalMinor: 10000, taxMinor: 0, totalMinor: 10000, terms: "Terms", message: "Hello <script>alert(1)</script>", snapshot: { ...trip(), companyName: "Transport", customerName: "Customer", customerEmail: "customer@example.test", tripCount: 1 }, items: [{ description: "Trip", quantity: 1, unitPriceMinor: 10000, totalMinor: 10000 }] });
  it("generates an actual PDF", async () => { const pdf = await quotationPdf(document()); expect(pdf.subarray(0, 5).toString()).toBe("%PDF-"); expect(pdf.length).toBeGreaterThan(1000); });
  it("escapes customer content in email HTML", () => { const html = quotationEmail(document(), "https://example.test/quotation"); expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;"); expect(html).toContain("Review &amp; accept"); });
});
