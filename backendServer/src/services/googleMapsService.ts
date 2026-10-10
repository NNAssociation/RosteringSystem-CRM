import { prisma } from "../db.js";

// Depot: Punchbowl Bus Company (SB)
export const DEPOT_LOCATION = {
  name: "Punchbowl Bus Company (SB)",
  lat: -33.9482,
  lng: 151.0506,
  address: "99 Belmore Rd, Riverwood NSW 2210, Australia",
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
  lon2: number,
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
 * Queries the Mapbox Directions API if configured, otherwise falls back to Haversine estimation.
 */
function formatCoordKey(loc: { lat: number; lng: number } | string): string {
  if (typeof loc === "string") return loc.trim();
  return `${Number(loc.lat.toFixed(4))},${Number(loc.lng.toFixed(4))}`;
}

export async function getTravelTime(
  origin: { lat: number; lng: number } | string,
  destination: { lat: number; lng: number } | string,
  _options?: any,
): Promise<TravelTimeResult> {
  const originKey = formatCoordKey(origin);
  const destKey = formatCoordKey(destination);

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
    // Database cache check is best-effort
  }

  // 2. Fetch from Mapbox Directions API or calculate fallback
  let durationMinutes = 30; // Default fallback
  let distanceKm = 15; // Default fallback

  const mapboxToken =
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_GEOCODING_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  let success = false;

  const origCoords = typeof origin === "string" ? parseCoords(originKey) : origin;
  const destCoords = typeof destination === "string" ? parseCoords(destKey) : destination;

  if (mapboxToken && origCoords && destCoords) {
    try {
      // Mapbox expects coordinates in lng,lat;lng,lat format
      const coords = `${origCoords.lng},${origCoords.lat};${destCoords.lng},${destCoords.lat}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=false&access_token=${mapboxToken}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.code === "Ok" && data.routes?.[0]) {
        const route = data.routes[0];
        durationMinutes = Math.ceil(route.duration / 60);
        distanceKm = Number((route.distance / 1000).toFixed(2));
        success = true;
      }
    } catch {
      // Fall through to Haversine fallback
    }
  }

  // 3. Fallback calculation if Mapbox API was not configured or failed
  if (!success && origCoords && destCoords) {
    distanceKm = Number(
      getHaversineDistance(origCoords.lat, origCoords.lng, destCoords.lat, destCoords.lng).toFixed(
        2,
      ),
    );
    // Assume average city speed of 50 km/h (1.2 minutes per km), min 5 mins
    durationMinutes = Math.max(5, Math.round(distanceKm * 1.2));
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
  } catch {
    // Cache write is best-effort
  }

  return { durationMinutes, distanceKm };
}

/**
 * Resolves the vehicle's home depot, or the configured system default depot.
 */
export async function vehicleDepot(vehicleId: number | undefined | null, db: any = prisma) {
  const vehicle = vehicleId
    ? await db.fleetVehicle.findUnique({ where: { id: vehicleId }, include: { homeDepot: true } })
    : null;
  const depot =
    vehicle?.homeDepot ||
    (process.env.DEFAULT_DEPOT_ID
      ? await db.depot.findUnique({ where: { id: Number(process.env.DEFAULT_DEPOT_ID) } })
      : null) ||
    (await db.depot.findFirst());
  if (!depot) {
    return {
      id: 0,
      name: DEPOT_LOCATION.name,
      lat: DEPOT_LOCATION.lat,
      lng: DEPOT_LOCATION.lng,
      address: DEPOT_LOCATION.address,
    };
  }
  return depot;
}

/**
 * Extracts point coordinates from a job for positioning calculations.
 */
export function jobPoint(job: any, end = false) {
  const lat = end ? job.jobEndLat : job.jobStartLat;
  const lng = end ? job.jobEndLng : job.jobStartLng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: -33.9482, lng: 151.0506 }; // Riverwood fallback
  }
  return { lat, lng };
}

/**
 * Batch travel time lookup.
 */
export async function getTravelTimeBatch(
  pairs: Array<{ origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }>,
): Promise<TravelTimeResult[]> {
  return Promise.all(pairs.map((p) => getTravelTime(p.origin, p.destination)));
}
