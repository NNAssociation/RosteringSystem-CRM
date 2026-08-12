import { prisma } from "../db.js";

// Depot: Punchbowl Bus Company (SB)
export const DEPOT_LOCATION = {
  name: "Punchbowl Bus Company (SB)",
  lat: -33.9482,
  lng: 151.0506,
  address: "99 Belmore Rd, Riverwood NSW 2210, Australia"
};


export interface TravelTimeResult {
  durationMinutes: number;
  distanceKm: number;
}

/**
 * Calculates straight-line distance between two coordinates in kilometers using Haversine formula.
 */
export function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parses coordinate string (e.g. "lat,lng") into numbers.
 */
function parseCoords(str: string): { lat: number; lng: number } | null {
  const parts = str.split(",");
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]!);
    const lng = parseFloat(parts[1]!);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Retrieves the travel time and distance between an origin and destination.
 * Checks the local TravelTimeCache database first.
 * Queries the Google Maps Distance Matrix API if configured, otherwise falls back to Haversine estimation.
 */
export async function getTravelTime(
  origin: { lat: number; lng: number } | string,
  destination: { lat: number; lng: number } | string
): Promise<TravelTimeResult> {
  const originKey =
    typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`;
  const destKey =
    typeof destination === "string" ? destination : `${destination.lat},${destination.lng}`;

  // 1. Check database cache
  try {
    const cached = await prisma.travelTimeCache.findUnique({
      where: {
        origin_destination: {
          origin: originKey,
          destination: destKey,
        },
      },
    });
    if (cached) {
      return {
        durationMinutes: cached.durationMinutes,
        distanceKm: cached.distanceKm ? Number(cached.distanceKm) : 0,
      };
    }
  } catch (err) {
    console.error("Failed to query TravelTimeCache:", err);
  }

  // 2. Fetch from Google Maps API or calculate fallback
  let durationMinutes = 30; // Default fallback
  let distanceKm = 15; // Default fallback

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  let success = false;

  if (apiKey && !apiKey.startsWith("pk_")) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
        originKey
      )}&destinations=${encodeURIComponent(destKey)}&key=${apiKey}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
        const element = data.rows[0].elements[0];
        const durationSec = element.duration.value;
        const distanceMeters = element.distance.value;

        durationMinutes = Math.ceil(durationSec / 60);
        distanceKm = Number((distanceMeters / 1000).toFixed(2));
        success = true;
      } else {
        console.warn("Distance Matrix API returned non-OK status:", data);
      }
    } catch (err) {
      console.error("Error calling Google Maps API:", err);
    }
  }

  // 3. Fallback calculation if Google Maps API was not used or failed
  if (!success) {
    const origCoords = typeof origin === "string" ? parseCoords(originKey) : origin;
    const destCoords =
      typeof destination === "string" ? parseCoords(destKey) : destination;

    if (origCoords && destCoords) {
      distanceKm = Number(
        getHaversineDistance(
          origCoords.lat,
          origCoords.lng,
          destCoords.lat,
          destCoords.lng
        ).toFixed(2)
      );
      // Assume average speed of 50 km/h (1.2 minutes per km)
      durationMinutes = Math.max(5, Math.round(distanceKm * 1.2));
    }
  }

  // 4. Save to database cache
  try {
    await prisma.travelTimeCache.upsert({
      where: {
        origin_destination: {
          origin: originKey,
          destination: destKey,
        },
      },
      update: {
        durationMinutes,
        distanceKm,
      },
      create: {
        origin: originKey,
        destination: destKey,
        durationMinutes,
        distanceKm,
      },
    });
  } catch (err) {
    console.error("Failed to save to TravelTimeCache:", err);
  }

  return { durationMinutes, distanceKm };
}

/**
 * Batch travel time lookup — resolves multiple origin-destination pairs.
 * Uses the single getTravelTime() under the hood (which has DB caching).
 * Useful for building travel time matrices without redundant API calls.
 */
export async function getTravelTimeBatch(
  pairs: Array<{ origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }>
): Promise<TravelTimeResult[]> {
  return Promise.all(
    pairs.map((p) => getTravelTime(p.origin, p.destination))
  );
}
