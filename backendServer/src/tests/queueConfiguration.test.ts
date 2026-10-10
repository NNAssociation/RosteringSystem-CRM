import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ redis: vi.fn(), queue: vi.fn() }));
vi.mock("ioredis", () => ({
  Redis: class {
    constructor(...args: unknown[]) {
      state.redis(...args);
    }
  },
}));
vi.mock("bullmq", () => ({
  Queue: class {
    constructor(...args: unknown[]) {
      state.queue(...args);
    }
  },
  QueueEvents: class {},
  Worker: class {
    on() {}
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});
it("passes the configured Redis URL to ioredis with worker-compatible retries", async () => {
  vi.stubEnv("REDIS_URL", "rediss://user:test-only@redis.example.test:6380/2");
  await import("../services/queueService.js");
  expect(state.redis).toHaveBeenCalledWith("rediss://user:test-only@redis.example.test:6380/2", {
    maxRetriesPerRequest: null,
  });
  expect(state.queue).toHaveBeenCalledWith("dispatch-queue", { connection: expect.any(Object) });
});
it("does not create a connection when Redis is not configured", async () => {
  vi.stubEnv("REDIS_URL", "");
  const { dispatchQueue } = await import("../services/queueService.js");
  expect(dispatchQueue).toBeNull();
  expect(state.redis).not.toHaveBeenCalled();
});
