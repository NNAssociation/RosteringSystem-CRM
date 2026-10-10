import { createHash } from "node:crypto";
import { z } from "zod";
import { WorkflowError } from "./workflowError.js";

export const itineraryPointSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  kind: z.enum(["STOP", "VIA"]).default("STOP"),
  address: z.string().max(2000),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  entrance: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
  accessNotes: z.string().max(2000).optional(),
  dwellSeconds: z.number().int().min(0).max(86400).optional(),
  placeId: z.string().optional(),
  source: z.enum(["GOOGLE", "MAPBOX", "MANUAL", "HERE", "TOMTOM"]).optional(),
});
export const itinerarySchema = z
  .array(itineraryPointSchema)
  .min(2)
  .max(22, "Maximum 20 intermediate points per direction")
  .superRefine((points, context) => {
    const ids = new Set<string>();
    points.forEach((point, index) => {
      if (point.id && ids.has(point.id))
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Each itinerary point needs a unique ID",
        });
      if (point.id) ids.add(point.id);
    });
  });
export const routeInputSchema = z.object({
  outboundItinerary: itinerarySchema,
  returnItinerary: itinerarySchema.optional(),
});
export function normalizePoints(points: any[], prefix: string) {
  return points.map((p, i) => ({
    ...p,
    id: p.id || `${prefix}-${i}`,
    kind: p.kind || "STOP",
    ...(p.kind === "VIA" ? { dwellSeconds: 0, entrance: undefined } : {}),
  }));
}
export function bookingItineraries(b: any) {
  const pickup = {
    address: b.startLocation || "",
    lat: b.pickupLat ?? undefined,
    lng: b.pickupLng ?? undefined,
    placeId: b.pickupPlaceId ?? undefined,
  };
  const dropoff = {
    address: b.endLocation || "",
    lat: b.dropoffLat ?? undefined,
    lng: b.dropoffLng ?? undefined,
    placeId: b.dropoffPlaceId ?? undefined,
  };
  const legacyStops = b.stops || [];
  const legacyFull =
    legacyStops.length >= 2 &&
    legacyStops[0]?.address === pickup.address &&
    legacyStops.at(-1)?.address === dropoff.address;
  const outboundItinerary = normalizePoints(
    b.outboundItinerary?.length >= 2
      ? b.outboundItinerary
      : legacyFull
        ? legacyStops
        : [pickup, ...legacyStops, dropoff],
    "outbound",
  );
  const returnItinerary = normalizePoints(
    b.returnItinerary?.length >= 2
      ? b.returnItinerary
      : [...outboundItinerary].reverse().map((p: any) => ({ ...p, id: undefined })),
    "return",
  );
  return { outboundItinerary, ...(b.bookingType === "round_trip" ? { returnItinerary } : {}) };
}
export function routeFingerprint(input: any) {
  const canonical = (points: any[]) =>
    points.map((p) => ({
      kind: p.kind || "STOP",
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      entrance: p.kind === "VIA" ? null : p.entrance || null,
      address: p.address || "",
      accessNotes: p.accessNotes || "",
      dwellSeconds: p.kind === "VIA" ? 0 : p.dwellSeconds || 0,
    }));
  return createHash("sha256")
    .update(
      JSON.stringify({
        outbound: canonical(input.outboundItinerary),
        return: input.returnItinerary ? canonical(input.returnItinerary) : null,
      }),
    )
    .digest("hex");
}
async function calculateDirection(points: any[], fetcher: typeof fetch) {
  if (points[0].kind === "VIA" || points.at(-1).kind === "VIA")
    throw new WorkflowError("Pickup and destination must be passenger stops");
  const coordinates = points.map((p, i) => {
    const c = p.kind === "VIA" ? p : p.entrance || p;
    if (
      !Number.isFinite(c.lat) ||
      !Number.isFinite(c.lng) ||
      Math.abs(c.lat) > 90 ||
      Math.abs(c.lng) > 180
    )
      throw new WorkflowError(`Choose valid coordinates for point ${i + 1}`);
    return `${c.lng},${c.lat}`;
  });
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token)
    throw new WorkflowError(
      "Route calculation is unavailable: configure the server MAPBOX_ACCESS_TOKEN",
      503,
    );
  const params = new URLSearchParams({
    access_token: token,
    geometries: "geojson",
    overview: "full",
    steps: "true",
    waypoints: points.flatMap((p, i) => (p.kind === "VIA" ? [] : [i])).join(";"),
  });
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const result = await fetcher(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates.join(";")}?${params}`,
      { signal: controller.signal },
    );
    if (!result.ok)
      throw new WorkflowError("Route provider is unavailable. Retry the calculation.", 503);
    const body: any = await result.json(),
      route = body.routes?.[0];
    if (
      body.code !== "Ok" ||
      !route ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration) ||
      route.distance < 0 ||
      route.duration < 0 ||
      route.geometry?.type !== "LineString"
    )
      throw new WorkflowError(
        "No drivable route found through these points. Move the points or retry.",
        422,
      );
    const drivingSeconds = route.duration;
    const baseMinutes = Math.round(drivingSeconds / 60);
    const coachDrivingSeconds = Math.max(Math.round(baseMinutes * 1.18), baseMinutes + 5) * 60;
    const stopSeconds = points.reduce(
      (sum, p) => sum + (p.kind === "VIA" ? 0 : p.dwellSeconds || 0),
      0,
    );
    return {
      geometry: route.geometry,
      distanceMeters: route.distance,
      drivingSeconds,
      coachDrivingSeconds,
      stopSeconds,
      serviceSeconds: coachDrivingSeconds + stopSeconds,
    };
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError(
      controller.signal.aborted
        ? "Route calculation timed out. Retry."
        : "Route calculation failed. Retry.",
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function calculateBookingRoute(raw: any, fetcher: typeof fetch = fetch) {
  const started = Date.now();
  let outcome = "ok";
  try {
    const input = routeInputSchema.parse(raw),
      fingerprint = routeFingerprint(input);
    const [outbound, returnRoute] = await Promise.all([
      calculateDirection(input.outboundItinerary, fetcher),
      input.returnItinerary ? calculateDirection(input.returnItinerary, fetcher) : undefined,
    ]);
    return {
      status: "VALID",
      fingerprint,
      provider: "MAPBOX",
      calculatedAt: new Date().toISOString(),
      outbound,
      ...(returnRoute ? { return: returnRoute } : {}),
    };
  } catch (error) {
    outcome = "failed";
    throw error;
  } finally {
    console.info(
      JSON.stringify({
        event: "booking.route_calculation",
        outcome,
        latencyMs: Date.now() - started,
      }),
    );
  }
}
/** Drafts retain invalid input and their previous result, explicitly marked outdated. */
export async function savedRoute(data: any, existing?: any) {
  if (!data.outboundItinerary && !existing?.routeCalculation) return undefined;
  const input = bookingItineraries(data),
    fingerprint = routeFingerprint(input);
  if (
    existing &&
    !existing.routeCalculation &&
    routeFingerprint(bookingItineraries(existing)) === fingerprint
  )
    return undefined;
  if (
    existing?.routeCalculation?.fingerprint === fingerprint &&
    existing.routeCalculation.status === "VALID"
  )
    return existing.routeCalculation;
  try {
    return await calculateBookingRoute(input);
  } catch (error) {
    return {
      status: "OUTDATED",
      fingerprint,
      error:
        error instanceof WorkflowError ? error.message : "Complete valid route points and retry",
      previous:
        existing?.routeCalculation?.status === "VALID"
          ? existing.routeCalculation
          : existing?.routeCalculation?.previous || null,
    };
  }
}
export function requireReviewedRoute(booking: any, review: any) {
  const route = booking.routeCalculation;
  if (!route) return; // Existing bookings are grandfathered until their itinerary changes.
  if (
    route.status !== "VALID" ||
    route.fingerprint !== routeFingerprint(bookingItineraries(booking))
  )
    throw new WorkflowError("Calculate a valid route before preparing a quotation", 409);
  if (
    review?.fingerprint !== route.fingerprint ||
    !["KEEP", "RECALCULATED"].includes(review?.action)
  )
    throw new WorkflowError(
      "Route changed — review required. Apply recalculated price or keep current price.",
      409,
    );
}
