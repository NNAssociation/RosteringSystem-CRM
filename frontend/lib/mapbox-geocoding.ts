/**
 * Mapbox Geocoding, Reverse Geocoding & Bus-Profile Route Directions Helper
 */

import type { StructuredLocation } from "@/types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export interface BusRouteCalculation {
  distanceKm: number;
  durationMinutes: number;
  busDrivingMinutes: number;
  geometry: {
    type: "LineString";
    coordinates: number[][];
  } | null;
  summaryText: string;
}

/**
 * Reverse geocode a latitude/longitude coordinate to a street address using Mapbox Geocoding API.
 */
export async function reverseGeocodeMapbox(
  lat: number,
  lng: number,
): Promise<StructuredLocation | null> {
  if (!MAPBOX_TOKEN || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,place&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;

    return {
      address: feature.place_name || feature.text || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat,
      lng,
      placeId: feature.id,
      source: "MAPBOX",
    };
  } catch (err) {
    console.error("Mapbox reverse geocode failed:", err);
    return null;
  }
}

/**
 * Forward geocode / search addresses using Mapbox Places API.
 */
export async function searchPlacesMapbox(
  query: string,
  countryCodes = ["au"],
): Promise<StructuredLocation[]> {
  if (!MAPBOX_TOKEN || !query.trim() || query.trim().length < 3) {
    return [];
  }

  try {
    const countriesParam = countryCodes.length ? `&country=${countryCodes.join(",")}` : "";
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query.trim(),
    )}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&types=address,poi,place&limit=5${countriesParam}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.features || []).map((f: any) => ({
      address: f.place_name || f.text,
      lat: f.center?.[1],
      lng: f.center?.[0],
      placeId: f.id,
      source: "MAPBOX",
    }));
  } catch (err) {
    console.error("Mapbox forward geocode search failed:", err);
    return [];
  }
}

/**
 * Calculates real driving directions suitable for a bus / coach.
 * Applies heavy-vehicle speed adjustments (+18% time buffer for buses due to highway speed limits and bus deceleration).
 */
export async function calculateBusRoute(
  stops: Array<{ lat?: number; lng?: number }>,
): Promise<BusRouteCalculation | null> {
  const validStops = stops.filter(
    (s): s is { lat: number; lng: number } =>
      typeof s.lat === "number" &&
      typeof s.lng === "number" &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng),
  );

  if (validStops.length < 2 || !MAPBOX_TOKEN) {
    return null;
  }

  try {
    // Coordinate pairs in lng,lat format joined by semicolons
    const coordsString = validStops.map((s) => `${s.lng},${s.lat}`).join(";");
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    const rawDistanceMeters = Number(route.distance) || 0;
    const rawDurationSeconds = Number(route.duration) || 0;

    const distanceKm = Math.round((rawDistanceMeters / 1000) * 10) / 10;
    const baseDurationMins = Math.round(rawDurationSeconds / 60);

    // Bus / coach adjustment: coaches operate under heavy-vehicle rules
    // We add 18% travel time for realistic bus running times
    const busDrivingMinutes = Math.max(Math.round(baseDurationMins * 1.18), baseDurationMins + 5);

    const hours = Math.floor(busDrivingMinutes / 60);
    const mins = busDrivingMinutes % 60;
    const timeFormatted =
      hours > 0 ? `${hours} hr ${mins > 0 ? `${mins} min` : ""}` : `${mins} min`;

    return {
      distanceKm,
      durationMinutes: baseDurationMins,
      busDrivingMinutes,
      geometry: route.geometry || null,
      summaryText: `${distanceKm} km · approx. ${timeFormatted} bus drive time`,
    };
  } catch (err) {
    console.error("Failed to calculate bus route:", err);
    return null;
  }
}
