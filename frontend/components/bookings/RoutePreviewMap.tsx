"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "@/providers/google-maps-provider";
import type { StructuredLocation } from "@/types";
import { DirectionsCar, AccessTime, Straighten, OpenInNew } from "@mui/icons-material";

interface RoutePreviewMapProps {
  pickup: StructuredLocation;
  dropoff: StructuredLocation;
  stops?: StructuredLocation[];
}

export function RoutePreviewMap({ pickup, dropoff, stops = [] }: RoutePreviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const { isLoaded, error: mapsError } = useGoogleMaps();

  const [routeResult, setRouteResult] = useState<{ key: string; error?: string; info?: {
    distanceText: string;
    durationText: string;
    summary?: string;
  } } | null>(null);
  const routeKey = JSON.stringify([pickup, dropoff, stops]);
  const routeInfo = routeResult?.key === routeKey ? routeResult.info : null;
  const routeError = routeResult?.key === routeKey ? routeResult.error : null;
  const loadingRoute = isLoaded && routeResult?.key !== routeKey;

  const hasLocations = Boolean(pickup?.address?.trim() && dropoff?.address?.trim());

  const validStops = stops.filter((s) => s.address && s.address.trim().length > 0);

  const googleMapsUrl = hasLocations
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        pickup.address
      )}&destination=${encodeURIComponent(dropoff.address)}${
        validStops.length > 0
          ? `&waypoints=${encodeURIComponent(validStops.map((s) => s.address).join("|"))}`
          : ""
      }`
    : "#";

  useEffect(() => {
    if (!hasLocations || !isLoaded || !mapContainerRef.current || typeof window === "undefined" || !window.google?.maps) {
      return;
    }

    let isDisposed = false;

    // Initialize Map if not already initialized
    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        zoom: 12,
        center: { lat: -33.8688, lng: 151.2093 }, // Default Sydney
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });
      mapInstanceRef.current = map;

      const renderer = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#2563eb", // blue-600
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
      });
      rendererRef.current = renderer;
    }

    const directionsService = new window.google.maps.DirectionsService();

    const origin =
      pickup.lat && pickup.lng && Number.isFinite(pickup.lat) && Number.isFinite(pickup.lng)
        ? { lat: pickup.lat, lng: pickup.lng }
        : pickup.address;

    const destination =
      dropoff.lat && dropoff.lng && Number.isFinite(dropoff.lat) && Number.isFinite(dropoff.lng)
        ? { lat: dropoff.lat, lng: dropoff.lng }
        : dropoff.address;

    const waypoints = validStops.map((s) => ({
      location:
        s.lat && s.lng && Number.isFinite(s.lat) && Number.isFinite(s.lng)
          ? { lat: s.lat, lng: s.lng }
          : s.address,
      stopover: true,
    }));

    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: any) => {
        if (isDisposed) return;

        if (status === window.google.maps.DirectionsStatus.OK && result) {
          rendererRef.current?.setDirections(result);

          let totalMeters = 0;
          let totalSeconds = 0;

          if (result.routes?.[0]?.legs) {
            for (const leg of result.routes[0].legs) {
              totalMeters += leg.distance?.value || 0;
              totalSeconds += leg.duration?.value || 0;
            }
          }

          const km = (totalMeters / 1000).toFixed(1);
          const mins = Math.round(totalSeconds / 60);
          const hours = Math.floor(mins / 60);
          const remainingMins = mins % 60;
          const durationStr =
            hours > 0 ? `${hours} hr ${remainingMins} min` : `${remainingMins} min`;

          setRouteResult({ key: routeKey, info: {
            distanceText: `${km} km`,
            durationText: durationStr,
            summary: result.routes?.[0]?.summary || undefined,
          } });
        } else {
          rendererRef.current?.set("directions", null);
          setRouteResult({ key: routeKey, error: "Could not calculate driving directions for these addresses." });
        }
      }
    );

    return () => {
      isDisposed = true;
    };
  }, [hasLocations, isLoaded, routeKey]);

  if (!hasLocations) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <DirectionsCar fontSize="small" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Route Preview</h4>
            <p className="text-xs text-slate-500">
              {validStops.length > 0
                ? `${validStops.length} stop${validStops.length > 1 ? "s" : ""} included`
                : "Direct driving route"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {routeInfo && (
            <>
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm border border-slate-200/60">
                <Straighten style={{ fontSize: "15px" }} className="text-slate-400" />
                <span>{routeInfo.distanceText}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm border border-slate-200/60">
                <AccessTime style={{ fontSize: "15px" }} className="text-slate-400" />
                <span>{routeInfo.durationText}</span>
              </div>
            </>
          )}

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 border border-slate-200/60 transition-colors shadow-sm"
          >
            <span>Open in Maps</span>
            <OpenInNew style={{ fontSize: "13px" }} />
          </a>
        </div>
      </div>

      {mapsError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
          {mapsError}
        </div>
      ) : (
        <div className="relative w-full h-[280px] sm:h-[320px] rounded-xl overflow-hidden border border-slate-200/80 shadow-inner bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full" />
          {(loadingRoute || routeError) && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center text-xs font-medium text-slate-600">
              {routeError || "Calculating route…"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
