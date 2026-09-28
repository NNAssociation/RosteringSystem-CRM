"use client";
import { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "@/providers/google-maps-provider";
import type { StructuredLocation } from "@/types";

interface PlaceSearchProps {
  onSelect: (location: StructuredLocation) => void;
  label?: string;
  includedRegionCodes?: string[];
}

/** Google owns the suggestions UI, keyboard support and attribution. */
export function PlaceSearch({
  onSelect,
  label = "Search address, airport or venue",
  includedRegionCodes = ["au"],
}: PlaceSearchProps) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onSelect);
  useEffect(() => { callback.current = onSelect; }, [onSelect]);
  const { isLoaded, error: loaderError } = useGoogleMaps();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isLoaded || !host.current) return;
    let disposed = false, widget: any, version = 0;
    const select = async (event: any) => {
      const request = ++version;
      try {
        setError("");
        const place = event.placePrediction.toPlace();
        await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
        if (disposed || request !== version) return;
        if (!place.location) throw new Error("No coordinates");
        callback.current({ address: place.formattedAddress || place.displayName || "", lat: place.location.lat(), lng: place.location.lng(), placeId: place.id });
      } catch { if (!disposed) setError("Could not retrieve that location. Try another result or select a point on the map."); }
    };
    const failed = () => setError("Location search is unavailable. Check that Places API (New) is enabled, or select on the map.");
    void window.google.maps.importLibrary("places").then(({ PlaceAutocompleteElement }: any) => {
      if (disposed) return;
      const options: Record<string, any> = {};
      if (includedRegionCodes && includedRegionCodes.length > 0) {
        options.includedRegionCodes = includedRegionCodes;
      }
      widget = new PlaceAutocompleteElement(options);
      widget.placeholder = label;
      widget.setAttribute("aria-label", label);
      widget.style.width = "100%";
      widget.style.colorScheme = "light";
      widget.style.setProperty("color-scheme", "light");
      widget.style.setProperty("--gmpx-color-surface", "#ffffff");
      widget.style.setProperty("--gmpx-color-on-surface", "#0f172a");
      widget.style.setProperty("--gmpx-color-on-surface-variant", "#64748b");
      widget.style.setProperty("--gmpx-color-primary", "#2563eb");
      widget.style.setProperty("--gmpx-color-outline", "#cbd5e1");
      widget.addEventListener("gmp-select", select);
      widget.addEventListener("gmp-error", failed);
      host.current?.appendChild(widget);
    }).catch(failed);
    return () => { disposed = true; version++; widget?.removeEventListener("gmp-select", select); widget?.removeEventListener("gmp-error", failed); widget?.remove(); };
  }, [isLoaded, label, includedRegionCodes]);
  return <div className="space-y-2 w-full"><div ref={host} className="place-search-host w-full" style={{ colorScheme: "light" }} />{!isLoaded && !loaderError && <p role="status" className="text-xs text-slate-500">Loading location search…</p>}{(loaderError || error) && <p role="alert" className="text-xs text-amber-800">{loaderError || error}</p>}</div>;
}
