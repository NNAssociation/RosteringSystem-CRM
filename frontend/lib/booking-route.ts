import type { StructuredLocation } from "@/types";
import type { BookingTrip } from "@/types/booking-workflow";
export function routePoints(points: StructuredLocation[], prefix: string): StructuredLocation[] {
  return points.map((point, i) => ({
    ...point,
    id: point.id || `${prefix}-${i}`,
    kind: point.kind || "STOP",
  }));
}
export function tripRouteInput(trip: BookingTrip) {
  const outboundItinerary = routePoints(
    [trip.pickup, ...(trip.outboundItinerary?.slice(1, -1) || trip.stops), trip.dropoff],
    "outbound",
  );
  const returnItinerary = routePoints(
    trip.returnItinerary.length >= 2 ? trip.returnItinerary : [...outboundItinerary].reverse(),
    "return",
  ).map((p, i, all) => {
    const endpoint = i === 0 ? trip.dropoff : i === all.length - 1 ? trip.pickup : null;
    return {
      ...p,
      ...(endpoint
        ? {
            address: endpoint.address,
            lat: endpoint.lat,
            lng: endpoint.lng,
            placeId: endpoint.placeId,
          }
        : {}),
      id: trip.returnItinerary[i]?.id || `return-${i}`,
    };
  });
  return { outboundItinerary, ...(trip.bookingType === "round_trip" ? { returnItinerary } : {}) };
}
export function moveRoutePoint(points: StructuredLocation[], from: number, to: number) {
  if (from <= 0 || to <= 0 || from >= points.length - 1 || to >= points.length - 1) return points;
  const next = [...points],
    [point] = next.splice(from, 1);
  next.splice(to, 0, point);
  return next;
}

/** Resolve booking wall-clock inputs in the booking's zone, not the operator's browser zone. */
export function scheduledRouteSeconds(start: string, end: string, timeZone: string) {
  const instant = (wall: string) => {
    const target = Date.parse(`${wall}:00Z`);
    if (!Number.isFinite(target)) return NaN;
    let value = target;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    for (let i = 0; i < 4; i++) {
      const p = Object.fromEntries(
        formatter.formatToParts(value).map((part) => [part.type, part.value]),
      );
      const correction =
        target - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
      if (!correction) return value;
      value += correction;
    }
    return NaN; // Nonexistent local time; booking validation handles this on save.
  };
  try {
    return (instant(end) - instant(start)) / 1000;
  } catch {
    return NaN;
  }
}
