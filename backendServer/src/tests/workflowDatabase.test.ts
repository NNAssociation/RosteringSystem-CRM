import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

// Explicit opt-in: never use the application's DATABASE_URL for destructive test setup.
const enabled = Boolean(process.env.TEST_DATABASE_URL);
const state = vi.hoisted(() => ({ client: null as any }));
vi.mock("../db.js", () => ({ get prisma() { return state.client; } }));
vi.mock("../services/googleMapsService.js", () => ({ getTravelTime: vi.fn().mockResolvedValue({ durationMinutes: 0, distanceKm: 0 }), DEPOT_LOCATION: { lat: -33.9482, lng: 151.0506, address: "Test depot" } }));
vi.mock("../services/conflictService.js", () => ({ checkDriverConflict: vi.fn().mockResolvedValue({ hasConflict: false }), checkVehicleConflict: vi.fn().mockResolvedValue({ hasConflict: false }), checkDriverFatigue: vi.fn().mockResolvedValue({ hasConflict: false }) }));
vi.mock("../services/settingsService.js", () => ({ getSchedulingRules: vi.fn().mockResolvedValue({}) }));

describe.skipIf(!enabled)("PostgreSQL workflow transactions", () => {
  let pool: pg.Pool, customerId: number, driverId: number, vehicleId: number;
  const bookings: number[] = [];
  const prefix = `workflow-test-${randomUUID()}`;
  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!url.pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL must point to a dedicated database ending in _test");
    const [{ default: pkg }, { PrismaPg }] = await Promise.all([import("../../generated/prisma/index.js"), import("@prisma/adapter-pg")]);
    pool = new pg.Pool({ connectionString: url.toString() });
    state.client = new pkg.PrismaClient({ adapter: new PrismaPg(pool as any) });
    customerId = (await state.client.customer.create({ data: { email: `${prefix}@example.test`, name: "Test customer" } })).id;
    driverId = (await state.client.user.create({ data: { email: `${prefix}-driver@example.test`, role: "DRIVER", status: "ACTIVE", skills: [] } })).id;
    vehicleId = (await state.client.fleetVehicle.create({ data: { make: "Test", model: "Bus", year: 2030, licensePlate: prefix, vin: prefix, status: "ACTIVE", maxPassengers: 50 } })).id;
  });
  afterAll(async () => {
    if (!state.client) return;
    const assignments = await state.client.assignment.findMany({ where: { job: { bookingId: { in: bookings } } }, select: { id: true } });
    await state.client.workflowEvent.deleteMany({ where: { OR: [...bookings.map(id => ({ payload: { path: ["bookingId"], equals: id } })), ...assignments.map((a: any) => ({ payload: { path: ["assignmentId"], equals: a.id } }))] } });
    await state.client.emailDelivery.deleteMany({ where: { quotation: { bookingId: { in: bookings } } } });
    await state.client.quotationItem.deleteMany({ where: { quotation: { bookingId: { in: bookings } } } });
    await state.client.quotation.deleteMany({ where: { bookingId: { in: bookings } } });
    await state.client.assignment.deleteMany({ where: { job: { bookingId: { in: bookings } } } });
    await state.client.job.deleteMany({ where: { bookingId: { in: bookings } } });
    await state.client.activityLog.deleteMany({ where: { entity: "Booking", entityId: { in: bookings } } });
    await state.client.booking.deleteMany({ where: { id: { in: bookings } } });
    await state.client.driverAvailability.deleteMany({ where: { driverId } });
    await state.client.user.delete({ where: { id: driverId } });
    await state.client.fleetVehicle.delete({ where: { id: vehicleId } });
    await state.client.customer.delete({ where: { id: customerId } });
    await state.client.$disconnect(); await pool.end();
  });
  async function fixture() {
    const token = randomBytes(32).toString("base64url");
    const { hashToken } = await import("../services/quotationService.js");
    const booking = await state.client.booking.create({ data: { customerId, subject: prefix, status: "AWAITING_RESPONSE", startLocation: "Pickup", endLocation: "Destination", startDateTime: new Date("2035-01-01T00:00Z"), endDateTime: new Date("2035-01-01T01:00Z"), noOfVehicles: 1, passengerCount: 10 } });
    bookings.push(booking.id);
    const quote = await state.client.quotation.create({ data: { bookingId: booking.id, revision: 1, status: "SENT", subtotalMinor: 10000, taxMinor: 0, totalMinor: 10000, expiresAt: new Date("2034-12-31T00:00Z"), snapshot: { customerEmail: `${prefix}@example.test` }, tokenHash: hashToken(token) } });
    return { booking, quote, token };
  }
  it("serializes simultaneous acceptance into one set of jobs and one confirmation", async () => {
    const f = await fixture(), { respondToQuotation } = await import("../services/quotationService.js");
    await Promise.all(Array.from({ length: 4 }, () => respondToQuotation(f.token, { decision: "ACCEPT", name: "Customer", acceptTerms: true })));
    expect(await state.client.job.count({ where: { bookingId: f.booking.id, status: "UNASSIGNED" } })).toBe(1);
    expect(await state.client.emailDelivery.count({ where: { quotationId: f.quote.id } })).toBe(1);
  });
  it("serializes competing assignments so only one consumes the remaining vehicle slot", async () => {
    const f = await fixture(), { respondToQuotation } = await import("../services/quotationService.js"), { createAssignment } = await import("../services/assignmentService.js");
    await respondToQuotation(f.token, { decision: "ACCEPT", name: "Customer", acceptTerms: true });
    const job = await state.client.job.findFirst({ where: { bookingId: f.booking.id } });
    const input = { jobId: job.id, driverId, vehicleId, scheduledStart: job.jobStartDateTime.toISOString(), scheduledEnd: job.jobEndDateTime.toISOString() };
    const results = await Promise.allSettled([createAssignment(input), createAssignment(input)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await state.client.assignment.count({ where: { jobId: job.id, status: { not: "CANCELLED" } } })).toBe(1);
  });
  it("rolls back acceptance when writing its durable event fails", async () => {
    const f = await fixture(), { respondToQuotation } = await import("../services/quotationService.js");
    const original = state.client;
    state.client = { ...original, quotation: original.quotation, $transaction: (fn: any, options: any) => original.$transaction((tx: any) => fn(new Proxy(tx, { get(target, key) { return key === "workflowEvent" ? { create: () => { throw new Error("Simulated event write failure"); } } : target[key]; } })), options) };
    try { await expect(respondToQuotation(f.token, { decision: "ACCEPT", name: "Customer", acceptTerms: true })).rejects.toThrow(); } finally { state.client = original; }
    expect((await original.booking.findUnique({ where: { id: f.booking.id } })).status).toBe("AWAITING_RESPONSE");
    expect(await original.job.count({ where: { bookingId: f.booking.id } })).toBe(0);
    expect((await original.quotation.findUnique({ where: { id: f.quote.id } })).status).toBe("SENT");
  });
  it("applies the migration and preserves legacy operational bookings without inventing acceptance", async () => {
    const connection = await pool.connect();
    const schema = `migration_${randomBytes(8).toString("hex")}`;
    try {
      await connection.query("BEGIN");
      await connection.query(`CREATE SCHEMA "${schema}"`);
      await connection.query(`SET LOCAL search_path TO "${schema}"`);
      await connection.query(`CREATE TABLE "Booking" (id SERIAL PRIMARY KEY, status TEXT, "startDateTime" TIMESTAMP, "endDateTime" TIMESTAMP); CREATE TABLE "Job" (id SERIAL PRIMARY KEY, "bookingId" INT, "jobStartDateTime" TIMESTAMP, "jobEndDateTime" TIMESTAMP, "durationHours" DECIMAL); CREATE TABLE "Assignment" (id SERIAL PRIMARY KEY, "jobId" INT, status TEXT, version INT DEFAULT 1, "scheduledStart" TIMESTAMP, "scheduledEnd" TIMESTAMP); CREATE TABLE "DriverAvailability" (id SERIAL PRIMARY KEY); INSERT INTO "Booking" (status) VALUES ('Pending'), ('Pending'), ('Confirmed'), ('Cancelled'); INSERT INTO "Job" ("bookingId") VALUES (2); INSERT INTO "Assignment" ("jobId", status) VALUES (1, 'CONFIRMED');`);
      await connection.query(await readFile(new URL("../../prisma/migrations/202609270001_quotation_workflow/migration.sql", import.meta.url), "utf8"));
      const rows = (await connection.query('SELECT status, "confirmationSource", "confirmedAt" FROM "Booking" ORDER BY id')).rows;
      expect(rows.map(r => r.status)).toEqual(["DRAFT", "CONFIRMED", "CONFIRMED", "CANCELLED"]);
      expect(rows[1].confirmationSource).toBe("LEGACY_OPERATIONAL"); expect(rows[1].confirmedAt).toBeNull();
    } finally { await connection.query("ROLLBACK"); connection.release(); }
  });
});
