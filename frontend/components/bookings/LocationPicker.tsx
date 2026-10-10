"use client";

import { MapPickerModal } from "@/components/shared/MapPickerModal";
import { PlaceSearch } from "@/components/shared/PlaceSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canMapLocation } from "@/lib/map-locations";
import { cn } from "@/lib/utils";
import type { StructuredLocation } from "@/types";
import { CheckCircle2, Info, Map as MapIcon, MapPin, Navigation, Pencil, X } from "lucide-react";
import { useId, useState } from "react";

export function LocationPicker({
  label,
  value,
  onChange,
  error,
  placeholder = "Search street address or place",
  includedRegionCodes,
  embedded = false,
}: {
  label: string;
  value: StructuredLocation;
  onChange: (location: StructuredLocation) => void;
  error?: string;
  placeholder?: string;
  includedRegionCodes?: string[];
  embedded?: boolean;
}) {
  const [openMap, setOpenMap] = useState(false);
  const [isEditing, setIsEditing] = useState(!value?.address);
  const [isManual, setIsManual] = useState(false);
  const isLoaded = !!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const mapsError = isLoaded ? null : "Mapbox is not configured";
  const id = useId();

  // Fallback to manual address input if Mapbox is missing
  const effectiveIsManual = isManual || !!mapsError;

  const isPickup =
    label.toLowerCase().includes("pickup") || label.toLowerCase().includes("departure");
  const isDestination =
    label.toLowerCase().includes("destination") || label.toLowerCase().includes("drop");
  const mapped = Number.isFinite(value?.lat) && Number.isFinite(value?.lng);

  const handleSelect = (loc: StructuredLocation) => {
    onChange(loc);
    setIsEditing(false);
    setIsManual(false);
  };

  const handleClear = () => {
    onChange({ address: "", lat: undefined, lng: undefined, placeId: undefined });
    setIsEditing(true);
    setIsManual(false);
  };

  const content = (
    <div className="space-y-2.5">
      {/* Standalone Header (only when not embedded) */}
      {!embedded && (
        <div className="flex items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold shadow-2xs",
                isPickup
                  ? "bg-emerald-100 text-emerald-700"
                  : isDestination
                    ? "bg-rose-100 text-rose-700"
                    : "bg-blue-100 text-blue-700",
              )}
            >
              {isPickup ? (
                <Navigation className="h-3.5 w-3.5" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
            </span>
            <label htmlFor={id} className="text-sm font-bold text-slate-800">
              {label}
            </label>
          </div>

          <div className="flex items-center gap-2">
            {mapped && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <CheckCircle2 className="h-3 w-3" /> Mapped
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl"
              disabled={!isLoaded}
              title={mapsError ? "Mapbox is not configured in this environment" : undefined}
              onClick={() => setOpenMap(true)}
            >
              <MapIcon className="h-3.5 w-3.5" /> Pin on map
            </Button>
          </div>
        </div>
      )}

      {/* Main Selected vs Editing Content */}
      {value?.address && !isEditing ? (
        /* Selected State */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 transition-all">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                {value.address}
              </span>
              {mapped && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-100/70 text-emerald-800 shrink-0">
                  <CheckCircle2 className="h-2.5 w-2.5" /> GPS
                </span>
              )}
            </div>
            {mapped ? (
              <p className="text-[11px] text-slate-400 font-mono">
                {value.lat?.toFixed(5)}, {value.lng?.toFixed(5)}
              </p>
            ) : (
              <p className="text-[11px] text-amber-700 font-medium">
                Manual entry (no GPS coordinates)
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 text-slate-700 border-slate-200 hover:bg-white rounded-lg shadow-2xs"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3 mr-1 text-slate-500" /> Change
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 text-slate-600 border-slate-200 hover:bg-white rounded-lg"
              onClick={() => setOpenMap(true)}
              title="Pinpoint exact spot on map"
            >
              <MapIcon className="h-3 w-3 mr-1 text-blue-600" /> Pin
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
              onClick={handleClear}
              title="Clear location"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        /* Search / Input State */
        <div className="space-y-2">
          {effectiveIsManual ? (
            <div className="space-y-2">
              <Input
                id={id}
                autoFocus={isEditing && !value?.address}
                aria-label={`${label} address`}
                value={value?.address || ""}
                placeholder="Type full address, venue or landmark…"
                onChange={(e) => onChange({ address: e.target.value, source: "MANUAL" })}
                className="bg-white border-slate-200 rounded-xl text-xs sm:text-sm h-10 shadow-2xs focus-visible:ring-blue-600"
              />
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-2">
                {mapsError ? (
                  <span className="text-amber-700 flex items-center gap-1 font-medium text-[11px]">
                    <Info className="h-3.5 w-3.5" />
                    Mapbox not configured. Manual address entry is active.
                  </span>
                ) : (
                  <>
                    <span className="text-[11px] text-slate-400">
                      Manual address draft (no GPS pin).
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsManual(false)}
                      className="text-blue-600 hover:underline font-semibold text-[11px]"
                    >
                      Use address search
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <PlaceSearch
                    label={placeholder}
                    onSelect={handleSelect}
                    includedRegionCodes={includedRegionCodes}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 px-3 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shrink-0 shadow-2xs gap-1.5"
                  onClick={() => setOpenMap(true)}
                  title="Choose exact spot on map"
                >
                  <MapIcon className="h-3.5 w-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Map</span>
                </Button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Start typing street name, hotel, or venue</span>
                <button
                  type="button"
                  onClick={() => setIsManual(true)}
                  className="text-slate-600 hover:text-slate-900 hover:underline font-medium"
                >
                  Enter manual text
                </button>
              </div>
            </div>
          )}

          {value?.address && (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-500 hover:text-slate-800"
                onClick={() => setIsEditing(false)}
              >
                Cancel change
              </Button>
            </div>
          )}
        </div>
      )}

      {mapped && !canMapLocation(value) && (
        <p className="text-xs text-amber-800">
          Reselect this location to pin on Mapbox. Its saved text remains unchanged.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 font-semibold">
          {error}
        </p>
      )}

      <MapPickerModal
        isOpen={openMap}
        onClose={() => setOpenMap(false)}
        initialLocation={mapped && canMapLocation(value) ? value : undefined}
        onSelect={handleSelect}
        includedRegionCodes={includedRegionCodes}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs p-4 sm:p-5 space-y-3 transition-all hover:border-slate-300">
      {content}
    </div>
  );
}
