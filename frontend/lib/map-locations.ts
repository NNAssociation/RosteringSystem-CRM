import type { StructuredLocation } from "@/types";

// Unknown legacy provenance is not assumed to permit Mapbox display.
export function canMapLocation(location: StructuredLocation) {
  return location.source === "MAPBOX" || location.source === "MANUAL";
}

export function mapPoint(location: StructuredLocation) {
  if (!canMapLocation(location)) return null;
  const p = location.entrance || location;
  return typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
    ? { lat: p.lat, lng: p.lng }
    : null;
}
