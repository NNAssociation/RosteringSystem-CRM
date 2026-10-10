import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookingItineraries,
  calculateBookingRoute,
  requireReviewedRoute,
  routeFingerprint,
  savedRoute,
} from "../services/bookingRoute.js";
import { bookingData, buildJobs } from "../services/bookingWorkflow.js";
import { createBookingSchema, updateBookingSchema } from "../validators/bookingSchema.js";

const point = (id: string, extra: any = {}) => ({
  id,
  kind: "STOP",
  address: id,
  lat: 0,
  lng: Number(id) || 0,
  ...extra,
});
const input = () => ({
  outboundItinerary: [
    point("0"),
    point("1", { kind: "VIA", dwellSeconds: 600 }),
    point("2", { dwellSeconds: 300, entrance: { lat: 1, lng: 2 } }),
    point("3"),
  ],
});
const response = () =>
  ({
    ok: true,
    json: async () => ({
      code: "Ok",
      routes: [
        {
          distance: 10000,
          duration: 600,
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [3, 0],
            ],
          },
        },
      ],
    }),
  }) as Response;
beforeEach(() => {
  vi.stubEnv("MAPBOX_ACCESS_TOKEN", "test-token");
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Mapbox booking route adapter", () => {
  it("keeps every coordinate in order, uses entrances, and excludes via points from waypoint legs and dwell", async () => {
    const fetcher = vi.fn().mockResolvedValue(response());
    const result = await calculateBookingRoute(input(), fetcher);
    const url = new URL(fetcher.mock.calls[0]![0]);
    expect(url.pathname).toContain("0,0;1,0;2,1;3,0");
    expect(url.searchParams.get("waypoints")).toBe("0;2;3");
    expect(url.searchParams.get("steps")).toBe("true");
    expect(result.outbound).toMatchObject({
      distanceMeters: 10000,
      drivingSeconds: 600,
      coachDrivingSeconds: 900,
      stopSeconds: 300,
      serviceSeconds: 1200,
    });
  });
  it("calculates return independently and fingerprints both directions", async () => {
    const fetcher = vi.fn().mockResolvedValue(response()),
      outbound = input();
    const returnItinerary = [...outbound.outboundItinerary].reverse();
    const result = await calculateBookingRoute({ ...outbound, returnItinerary }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new URL(fetcher.mock.calls[1]![0]).pathname).toContain("3,0;2,1;1,0;0,0");
    expect(result.fingerprint).not.toBe(routeFingerprint(outbound));
    expect(result.return?.stopSeconds).toBe(300);
  });
  it("allows 20 intermediate points and rejects 21 without calling the provider", async () => {
    const fetcher = vi.fn().mockResolvedValue(response());
    await calculateBookingRoute(
      { outboundItinerary: Array.from({ length: 22 }, (_, i) => point(String(i))) },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockClear();
    await expect(
      calculateBookingRoute(
        { outboundItinerary: Array.from({ length: 23 }, (_, i) => point(String(i))) },
        fetcher,
      ),
    ).rejects.toThrow("20 intermediate");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { lat: undefined },
    { lng: null },
    { lat: 91 },
    { lng: -181 },
    { entrance: { lat: 200, lng: 0 } },
  ])("rejects invalid coordinates instead of skipping %j", async (bad) => {
    const fetcher = vi.fn();
    await expect(
      calculateBookingRoute(
        { outboundItinerary: [point("0"), point("1", bad), point("2")] },
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("surfaces unavailable and undrivable routes without provider details", async () => {
    await expect(
      calculateBookingRoute(input(), vi.fn().mockResolvedValue({ ok: false })),
    ).rejects.toThrow("unavailable");
    await expect(
      calculateBookingRoute(
        input(),
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: "NoRoute" }) }),
      ),
    ).rejects.toThrow("No drivable route");
    await expect(
      calculateBookingRoute(input(), vi.fn().mockRejectedValue(new Error("token-secret"))),
    ).rejects.toThrow("Route calculation failed");
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("test-token");
  });
  it("aborts timed out provider requests", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url, options) =>
        new Promise<Response>((_, reject) =>
          options.signal.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    const pending = expect(calculateBookingRoute(input(), fetcher as any)).rejects.toThrow(
      "timed out",
    );
    await vi.advanceTimersByTimeAsync(12000);
    await pending;
  });
});

describe("Itinerary compatibility and price review", () => {
  const base = () =>
    bookingData({
      date: "2030-01-02",
      startTime: "09:00",
      endTime: "11:00",
      pickupLocation: "0",
      dropoffLocation: "3",
      bookingType: "round_trip",
      returnTime: "14:00",
      returnEndTime: "17:00",
      ...input(),
      returnItinerary: [point("3"), point("4", { kind: "VIA" }), point("0")],
      returnItineraryConfirmed: true,
    });
  it("validators retain richer points, return arrival and authoritative itineraries", () => {
    const result = createBookingSchema.parse({
      customerEmail: "test@example.test",
      date: "2030-01-02",
      pickupLocation: "0",
      dropoffLocation: "3",
      ...input(),
      returnItinerary: [point("3"), point("0")],
      returnEndTime: "17:00",
      returnItineraryConfirmed: true,
    });
    expect(result.outboundItinerary?.[2]?.entrance).toEqual({ lat: 1, lng: 2 });
    expect(result.outboundItinerary?.[1]?.kind).toBe("VIA");
    expect(result.returnEndTime).toBe("17:00");
    expect(
      updateBookingSchema.parse({ outboundItinerary: input().outboundItinerary }).outboundItinerary,
    ).toHaveLength(4);
  });
  it("projects only passenger stops and dispatches each direction's full itinerary", () => {
    const booking = base(),
      jobs = buildJobs({ ...booking, id: 1 });
    expect(booking.stops).toHaveLength(1);
    expect(booking.stops[0].dwellSeconds).toBe(300);
    expect(jobs[0].itinerary.map((p: any) => p.id)).toEqual(["0", "1", "2", "3"]);
    expect(jobs[1].itinerary.map((p: any) => p.id)).toEqual(["3", "4", "0"]);
    expect(bookingData({ subject: "Changed title" }, booking).outboundItinerary).toEqual(
      booking.outboundItinerary,
    );
    expect(bookingData({ subject: "Changed title" }, booking).returnItinerary).toEqual(
      booking.returnItinerary,
    );
  });
  it("normalizes legacy points and does not opt unchanged legacy bookings into route enforcement", async () => {
    const old = bookingData({
      date: "2030-01-02",
      pickupLocation: "A",
      dropoffLocation: "B",
      stops: [{ address: "Old stop", lat: 0, lng: 0 }],
    });
    expect(bookingItineraries(old).outboundItinerary[1]).toMatchObject({
      kind: "STOP",
      id: "outbound-1",
    });
    const untouched = bookingData({ subject: "New subject" }, old);
    expect(await savedRoute(untouched, old)).toBeUndefined();
    const richLegacy = { ...old, ...bookingItineraries(old) };
    expect(
      await savedRoute(bookingData({ subject: "Other title" }, richLegacy), richLegacy),
    ).toBeUndefined();
    expect(() => requireReviewedRoute(old, undefined)).not.toThrow();
    expect(bookingData({ pickupLat: 2 }, old).outboundItinerary).toBeDefined();
  });
  it("requires review of the exact route, including stop duration, before quoting", async () => {
    const b = base(),
      routeCalculation = await calculateBookingRoute(
        bookingItineraries(b),
        vi.fn().mockResolvedValue(response()),
      );
    const booking = { ...b, routeCalculation },
      review = { fingerprint: routeCalculation.fingerprint, action: "KEEP" };
    expect(() => requireReviewedRoute(booking, review)).not.toThrow();
    expect(() => requireReviewedRoute(booking, undefined)).toThrow("review required");
    expect(() => requireReviewedRoute(booking, { ...review, fingerprint: "old" })).toThrow(
      "review required",
    );
    const changed = {
      ...booking,
      outboundItinerary: booking.outboundItinerary!.map((p: any, i: number) =>
        i === 2 ? { ...p, dwellSeconds: 500 } : p,
      ),
    };
    expect(() => requireReviewedRoute(changed, review)).toThrow("valid route");
  });
  it("preserves points and last geometry as outdated when saving fails", async () => {
    const b = base(),
      previous = await calculateBookingRoute(
        bookingItineraries(b),
        vi.fn().mockResolvedValue(response()),
      );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const changed = {
      ...b,
      outboundItinerary: b.outboundItinerary!.map((p: any, i: number) =>
        i === 1 ? { ...p, lng: 9 } : p,
      ),
    };
    const snapshot = await savedRoute(changed, { ...b, routeCalculation: previous });
    expect(snapshot).toMatchObject({ status: "OUTDATED", previous });
    expect(changed.outboundItinerary[1].lng).toBe(9);
    expect(() =>
      requireReviewedRoute(
        { ...changed, routeCalculation: snapshot },
        { fingerprint: previous.fingerprint, action: "KEEP" },
      ),
    ).toThrow("valid route");
  });
});
