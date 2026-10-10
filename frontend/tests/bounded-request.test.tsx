import { boundedRequest } from "@/lib/bounded-request";
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.useRealTimers());
it("aborts a hanging request without retrying an uncertain save", async () => {
  vi.useFakeTimers();
  let signal!: AbortSignal;
  const work = vi.fn((s: AbortSignal) => {
    signal = s;
    return new Promise(() => {});
  });
  const result = expect(boundedRequest(work, true, 100)).rejects.toThrow("may have been saved");
  await vi.advanceTimersByTimeAsync(100);
  await result;
  expect(signal.aborted).toBe(true);
  expect(work).toHaveBeenCalledTimes(1);
});
it("clears the timer after a completed request", async () => {
  vi.useFakeTimers();
  await expect(boundedRequest(async () => 42, false)).resolves.toBe(42);
  expect(vi.getTimerCount()).toBe(0);
});
