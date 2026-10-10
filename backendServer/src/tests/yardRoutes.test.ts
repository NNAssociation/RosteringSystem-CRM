import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURES } from "../middleware/featureFlag.js";
import { yardRouter } from "../routes/yardRoutes.js";
const state = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn() },
    assignment: { findMany: vi.fn() },
    fleetVehicle: { findMany: vi.fn() },
  },
  update: vi.fn(),
}));
vi.mock("../db.js", () => ({ prisma: state.db }));
vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({ userId: req.headers["x-test-role"] }),
  clerkClient: { users: { getUser: vi.fn() } },
}));
vi.mock("../services/assignmentService.js", () => ({ updateAssignment: state.update }));
describe("Yard vehicle changes", () => {
  let server: Server, origin: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/yard", yardRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.unstubAllEnvs();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(FEATURES, { DISPATCH_ENABLED: true });
    state.db.user.findUnique.mockImplementation(async ({ where }) => ({
      id: 3,
      role: where.clerkId,
      status: "ACTIVE",
    }));
    state.db.assignment.findMany.mockResolvedValue([]);
    state.db.fleetVehicle.findMany.mockResolvedValue([]);
    state.update.mockResolvedValue({ id: 1, vehicleId: 8, version: 3 });
  });
  const change = (role: string, body: any = { vehicleId: 8, version: 2 }) =>
    fetch(`${origin}/yard/assignments/1/vehicle`, {
      method: "PATCH",
      headers: { "x-test-role": role, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  it("requires authentication to read the yard board", async () => {
    expect((await fetch(`${origin}/yard/board`)).status).toBe(401);
  });
  it.each(["YARD", "ADMIN", "MANAGER", "DISPATCHER"])(
    "allows %s to replace a bus in one validated operation",
    async (role) => {
      expect((await change(role)).status).toBe(200);
      expect(state.update).toHaveBeenCalledExactlyOnceWith(
        1,
        { vehicleId: 8, version: 2 },
        { userId: 3 },
      );
    },
  );
  it.each(["DRIVER", "MECHANIC"])("does not grant yard mutation access to %s", async (role) => {
    expect((await change(role)).status).toBe(403);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("rejects driver, schedule or status changes through the yard endpoint", async () => {
    for (const extra of [
      { driverId: 7 },
      { status: "COMPLETED" },
      { scheduledStart: "2030-01-01T00:00:00Z" },
    ])
      expect((await change("YARD", { vehicleId: 8, version: 2, ...extra })).status).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("requires the assignment version", async () => {
    expect((await change("YARD", { vehicleId: 8 })).status).toBe(400);
  });
  it("preserves conflict errors without clearing the current allocation first", async () => {
    state.update.mockRejectedValueOnce(
      Object.assign(new Error("Vehicle has an overlapping assignment"), { status: 409 }),
    );
    const response = await change("YARD");
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("overlapping");
    expect(state.update).toHaveBeenCalledTimes(1);
  });
  it("allows yard staff to load operational data with explicit driver fields", async () => {
    expect(
      (await fetch(`${origin}/yard/board?date=2030-01-01`, { headers: { "x-test-role": "YARD" } }))
        .status,
    ).toBe(200);
    expect(state.db.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          driver: { select: { id: true, firstName: true, lastName: true, email: true } },
        }),
      }),
    );
  });
  it("respects the dispatch feature gate", async () => {
    Object.assign(FEATURES, { DISPATCH_ENABLED: false });
    expect((await change("YARD")).status).toBe(404);
  });
});
