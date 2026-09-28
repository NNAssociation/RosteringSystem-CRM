import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
const calls = vi.hoisted(() => ({ change: vi.fn().mockResolvedValue({ success: true }), overview: vi.fn().mockResolvedValue({ metrics: {} }) }));
vi.mock("@clerk/express", () => ({ getAuth: (req: any) => ({ userId: req.headers["x-test-role"] }), clerkClient: { users: { getUser: vi.fn(async role => ({ emailAddresses: [], publicMetadata: { role } })) } } }));
vi.mock("../services/recordLifecycle.js", () => ({ changeRecordLifecycle: calls.change, deletionEligibility: vi.fn().mockResolvedValue({ eligible: true, reasons: [] }) }));
vi.mock("../services/dashboardService.js", () => ({ dashboardOverview: calls.overview }));
vi.mock("../services/bookingService.js", () => ({ getBookingById: vi.fn().mockResolvedValue({ id: 1 }), cancelBooking: vi.fn().mockResolvedValue({ success: true }) }));
import { recordLifecycleRouter } from "../routes/recordLifecycleRoutes.js";
import dashboardRoutes from "../routes/dashboardRoutes.js";
describe("Operations route authorization", () => {
  let server: Server, origin: string;
  beforeAll(async () => { const app = express(); app.use("/customers", recordLifecycleRouter("customers")); app.use("/dashboard", dashboardRoutes); server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${(server.address() as any).port}`; });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  it("allows dashboard overview and rejects anonymous permanent deletion", async () => { expect((await fetch(`${origin}/dashboard/overview`)).status).toBe(200); expect((await fetch(`${origin}/customers/1?permanent=true`, { method: "DELETE" })).status).toBe(401); });
  it("rejects non-staff roles", async () => { expect((await fetch(`${origin}/customers/1/deletion-eligibility`, { headers: { "x-test-role": "DRIVER" } })).status).toBe(403); });
  it("preserves legacy DELETE deactivation and requires explicit permanent deletion", async () => {
    const headers = { "x-test-role": "ADMIN" };
    expect((await fetch(`${origin}/customers/1`, { method: "DELETE", headers })).status).toBe(200); expect(calls.change).toHaveBeenLastCalledWith("customers", 1, false);
    expect((await fetch(`${origin}/customers/1?permanent=true`, { method: "DELETE", headers })).status).toBe(200); expect(calls.change).toHaveBeenLastCalledWith("customers", 1, true);
  });
  it("validates identifiers and flags", async () => { const headers = { "x-test-role": "ADMIN" }; expect((await fetch(`${origin}/customers/nope?permanent=true`, { method: "DELETE", headers })).status).toBe(400); expect((await fetch(`${origin}/customers/1?permanent=yes`, { method: "DELETE", headers })).status).toBe(400); });
});
