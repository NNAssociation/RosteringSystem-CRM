import express from "express";
import { createServer, type Server } from "node:http";
import { Webhook } from "svix";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { quotationRouter } from "../routes/quotationRoutes.js";
import { assertEmployeeIdentityChange } from "../services/employeePermissions.js";
const state = vi.hoisted(() => ({ webhook: vi.fn() }));
vi.mock("../db.js", () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: any) => ({
        id: 1,
        role: where.clerkId,
        status: where.clerkId === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      }),
    },
  },
}));
vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({ userId: req.headers["x-test-role"] }),
  clerkClient: { users: { getUser: vi.fn() } },
}));
vi.mock("../services/emailProviders/resend.js", () => ({
  ResendProvider: class {
    handleWebhookEvent = state.webhook;
  },
}));
let server: Server, origin: string;
beforeAll(async () => {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, bytes) => {
        (req as any).rawBody = bytes.toString();
      },
    }),
  );
  app.use("/quotations", quotationRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it.each([undefined, "DRIVER", "MECHANIC", "INACTIVE"])(
  "protects pricing configuration from %s",
  async (role) => {
    const response = await fetch(`${origin}/quotations/config`, {
      headers: role ? { "x-test-role": role } : {},
    });
    expect(response.status).toBe(role ? 403 : 401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  },
);
it("fails closed when the Resend webhook secret is missing", async () => {
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
  const response = await fetch(`${origin}/quotations/webhooks/resend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  expect(response.status).toBe(503);
  expect(state.webhook).not.toHaveBeenCalled();
});
it("accepts signed raw payloads and rejects tampering and expired signatures", async () => {
  const secret = `whsec_${Buffer.from("test-signing-key-with-enough-bytes").toString("base64")}`;
  vi.stubEnv("RESEND_WEBHOOK_SECRET", secret);
  const body = '{ "type": "email.delivered", "data": { "email_id": "test" } }';
  const send = async (payload: string, timestamp: Date) =>
    fetch(`${origin}/quotations/webhooks/resend`, {
      method: "POST",
      body: payload,
      headers: {
        "content-type": "application/json",
        "svix-id": "test-message",
        "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
        "svix-signature": new Webhook(secret).sign("test-message", timestamp, body),
      },
    });
  expect((await send(body, new Date())).status).toBe(204);
  expect((await send("{}", new Date())).status).toBe(401);
  expect((await send(body, new Date(Date.now() - 600000))).status).toBe(401);
  expect(state.webhook).toHaveBeenCalledTimes(1);
});
it("prevents staff from granting privileges or changing account linkage", () => {
  expect(() => assertEmployeeIdentityChange("DISPATCHER", { role: "ADMIN" })).toThrow();
  expect(() =>
    assertEmployeeIdentityChange("MANAGER", { role: "ADMIN" }, { role: "MANAGER" }),
  ).toThrow();
  expect(() =>
    assertEmployeeIdentityChange(
      "DISPATCHER",
      { email: "other@example.test" },
      { email: "owner@example.test" },
    ),
  ).toThrow();
  expect(() => assertEmployeeIdentityChange("ADMIN", { role: "ADMIN" })).not.toThrow();
  expect(() => assertEmployeeIdentityChange("DISPATCHER", { role: "DRIVER" })).not.toThrow();
  expect(() =>
    assertEmployeeIdentityChange("DISPATCHER", { role: "DRIVER" }, { role: "DRIVER" }),
  ).not.toThrow();
});
