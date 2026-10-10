import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { requireEmployee, requireOffice } from "../middleware/employeeAuth.js";
import bookingRoutes from "../routes/bookingRoutes.js";
vi.mock("../db.js", () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: any) => ({ id: 1, role: where.clerkId, status: "ACTIVE" }),
    },
  },
}));
vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({ userId: req.headers["x-test-role"] }),
  clerkClient: { users: { getUser: vi.fn() } },
}));
let server: Server, origin: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/bookings", requireEmployee, requireOffice, bookingRoutes);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
it.each([
  [undefined, 401],
  ["DRIVER", 403],
  ["MECHANIC", 403],
  ["DISPATCHER", 400],
  ["MANAGER", 400],
  ["ADMIN", 400],
])("route preview access for %s returns %i", async (role, status) => {
  const response = await fetch(`${origin}/bookings/route-preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(role ? { "x-test-role": String(role) } : {}),
    },
    body: "{}",
  });
  expect(response.status).toBe(status);
});
