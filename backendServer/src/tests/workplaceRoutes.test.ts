import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { workplaceRouter } from "../routes/workplaceRoutes.js";
const state = vi.hoisted(() => ({ db: {} as any }));
vi.mock("../db.js", () => ({
  get prisma() {
    return state.db;
  },
}));
vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({ userId: req.headers["x-test-role"] }),
  clerkClient: { users: { getUser: vi.fn() } },
}));
describe("Workplace HTTP boundaries", () => {
  let server: Server, origin: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(workplaceRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  beforeEach(() => {
    vi.stubEnv("NOTICES_ENABLED", "true");
    vi.stubEnv("INCIDENTS_ENABLED", "true");
    vi.stubEnv("LOST_PROPERTY_ENABLED", "true");
    state.db = {
      user: {
        findUnique: vi.fn(async ({ where }: any) => ({
          id: 1,
          role: where.clerkId === "INACTIVE" ? "ADMIN" : where.clerkId,
          status: where.clerkId === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        })),
      },
      incident: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      lostPropertyReport: { findFirst: vi.fn().mockResolvedValue(null) },
      foundPropertyItem: { findFirst: vi.fn().mockResolvedValue(null) },
      notice: { findUnique: vi.fn().mockResolvedValue(null) },
      attachment: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    state.db.$transaction = (fn: any) =>
      typeof fn === "function" ? fn(state.db) : Promise.all(fn);
  });
  it.each([
    "/me",
    "/notices",
    "/incidents",
    "/lost-property/reports",
    "/lost-property/items",
    "/attachments?incidentId=1",
    "/notifications",
    "/workplace/lookups",
  ])("requires authentication at %s", async (path) => {
    expect((await fetch(origin + path)).status).toBe(401);
  });
  it("rejects an inactive employee despite administrative role", async () => {
    expect((await fetch(`${origin}/me`, { headers: { "x-test-role": "INACTIVE" } })).status).toBe(
      403,
    );
  });
  it.each(["DRIVER", "MECHANIC", "DISPATCHER", "MANAGER", "ADMIN"])(
    "returns database-derived capabilities for %s",
    async (role) => {
      const response = await fetch(`${origin}/me`, { headers: { "x-test-role": role } });
      expect(response.status).toBe(200);
      expect((await response.json()).office).toBe(
        ["DISPATCHER", "MANAGER", "ADMIN"].includes(role),
      );
    },
  );
  it.each([
    ["NOTICES_ENABLED", "/notices"],
    ["INCIDENTS_ENABLED", "/incidents"],
    ["LOST_PROPERTY_ENABLED", "/lost-property/items"],
  ])("enforces disabled feature %s on the server", async (flag, path) => {
    vi.stubEnv(flag!, "false");
    expect((await fetch(origin + path, { headers: { "x-test-role": "ADMIN" } })).status).toBe(404);
  });
  it.each([
    "/incidents/900",
    "/lost-property/reports/900",
    "/lost-property/items/900",
    "/notices/900",
    "/attachments/900",
  ])("does not expose guessed records at %s", async (path) => {
    expect((await fetch(origin + path, { headers: { "x-test-role": "DRIVER" } })).status).toBe(404);
  });
  it("scopes both list and count to reporter/owner", async () => {
    const response = await fetch(`${origin}/incidents`, { headers: { "x-test-role": "DRIVER" } });
    expect(response.status).toBe(200);
    const where = state.db.incident.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ reporterId: 1 }, { ownerId: 1 }]);
    expect(state.db.incident.count).toHaveBeenCalledWith({ where });
  });
  it("forbids publishing by a driver", async () => {
    expect(
      (
        await fetch(`${origin}/notices`, {
          method: "POST",
          headers: { "x-test-role": "DRIVER", "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
  });
  it("validates list pagination", async () => {
    expect(
      (await fetch(`${origin}/incidents?pageSize=500`, { headers: { "x-test-role": "DRIVER" } }))
        .status,
    ).toBe(400);
  });
  it("shows notice titles and priority for existing generic notifications", async () => {
    vi.stubEnv("INCIDENTS_ENABLED", "false");
    vi.stubEnv("LOST_PROPERTY_ENABLED", "false");
    state.db.$queryRaw = vi.fn().mockResolvedValue([{ id: 7 }]);
    state.db.notification = {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 10, entity: "Notice", entityId: 7, title: "A notice has been published" },
        ]),
      count: vi.fn().mockResolvedValue(1),
    };
    state.db.notice.findMany = vi.fn().mockResolvedValue([
      {
        id: 7,
        status: "PUBLISHED",
        publishedAt: new Date(),
        revisions: [
          {
            title: "Urgent depot closure",
            body: "Private message body",
            priority: "CRITICAL",
            category: "OPERATIONS",
            audience: ["DRIVER"],
          },
        ],
      },
    ]);
    const response = await fetch(`${origin}/notifications`, {
      headers: { "x-test-role": "DRIVER" },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toEqual([
      {
        id: 10,
        entity: "Notice",
        entityId: 7,
        title: "Urgent depot closure",
        priority: "CRITICAL",
        category: "OPERATIONS",
      },
    ]);
    expect(data.unreadCount).toBe(1);
    expect(JSON.stringify(data)).not.toContain("Private message body");
  });
  it("rechecks notice audience before returning notification titles", async () => {
    vi.stubEnv("INCIDENTS_ENABLED", "false");
    vi.stubEnv("LOST_PROPERTY_ENABLED", "false");
    state.db.$queryRaw = vi.fn().mockResolvedValue([{ id: 7 }]);
    state.db.notification = {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 10, entity: "Notice", entityId: 7, title: "A notice has been published" },
        ]),
      count: vi.fn().mockResolvedValue(1),
    };
    state.db.notice.findMany = vi.fn().mockResolvedValue([
      {
        id: 7,
        status: "PUBLISHED",
        publishedAt: new Date(),
        revisions: [{ title: "Management only", priority: "CRITICAL", audience: ["MANAGER"] }],
      },
    ]);
    const response = await fetch(`${origin}/notifications`, {
      headers: { "x-test-role": "DRIVER" },
    });
    expect((await response.json()).items).toEqual([]);
  });
});
