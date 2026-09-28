"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { StructuredLocation } from "@/types";
import { MapPickerModal } from "@/components/shared/MapPickerModal";
import { PlaceSearch } from "@/components/shared/PlaceSearch";
import { useGoogleMaps } from "@/providers/google-maps-provider";
import {
  Place,
  Navigation,
  Edit,
  Close,
  CheckCircle,
  Map as MapIcon,
  Search,
} from "@mui/icons-material";

declare global {
  interface Window {
    google: any;
  }
}

export function LocationPicker({
  label,
  value,
  onChange,
  error,
  placeholder = "Search address, airport or venue",
  includedRegionCodes,
}: {
  label: string;
  value: StructuredLocation;
  onChange: (location: StructuredLocation) => void;
  error?: string;
  placeholder?: string;
  includedRegionCodes?: string[];
}) {
  const [openMap, setOpenMap] = useState(false);
  const [isEditing, setIsEditing] = useState(!value?.address);
  const [isManual, setIsManual] = useState(false);
  const { isLoaded } = useGoogleMaps();
  const id = useId();

  const isPickup = label.toLowerCase().includes("pickup");
  const isDestination = label.toLowerCase().includes("destination");
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

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm p-4 sm:p-5 space-y-3 transition-all hover:border-slate-300">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
              isPickup
                ? "bg-emerald-100 text-emerald-700"
                : isDestination
                ? "bg-rose-100 text-rose-700"
                : "bg-sky-100 text-sky-700"
            }`}
          >
            {isPickup ? (
              <Navigation style={{ fontSize: "14px" }} />
            ) : (
              <Place style={{ fontSize: "15px" }} />
            )}
          </span>
          <label htmlFor={id} className="text-sm font-semibold text-slate-800">
            {label}
          </label>
        </div>

        <div className="flex items-center gap-2">
          {mapped && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <CheckCircle style={{ fontSize: "12px" }} /> Mapped
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium border-slate-200 hover:bg-slate-50 text-slate-700"
            disabled={!isLoaded}
            onClick={() => setOpenMap(true)}
          >
            <MapIcon style={{ fontSize: "14px" }} /> Choose on map
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {value?.address && !isEditing ? (
        /* Selected State Card */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {value.address}
            </p>
            {mapped ? (
              <p className="text-[11px] text-slate-500 font-mono">
                {value.lat?.toFixed(5)}, {value.lng?.toFixed(5)}
              </p>
            ) : (
              <p className="text-[11px] text-amber-700 font-medium">
                Manual entry (no coordinates)
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 text-slate-700 border-slate-200 hover:bg-white"
              onClick={() => setIsEditing(true)}
            >
              <Edit style={{ fontSize: "12px" }} className="mr-1" /> Change
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
              onClick={handleClear}
              title="Clear location"
            >
              <Close style={{ fontSize: "16px" }} />
            </Button>
          </div>
        </div>
      ) : (
        /* Search / Input State */
        <div className="space-y-2">
          {isManual ? (
            <div className="space-y-2">
              <Input
                id={id}
                autoFocus
                aria-label={`${label} address`}
                value={value?.address || ""}
                placeholder="Type full address, venue or landmark..."
                onChange={(e) => onChange({ address: e.target.value })}
                className="bg-white border-slate-200 focus-visible:ring-slate-900"
              />
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Manual address will be saved as draft without GPS pin.</span>
                <button
                  type="button"
                  onClick={() => setIsManual(false)}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Use Google Places search
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl border border-slate-200 bg-white p-1 focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-transparent transition-all shadow-sm">
                <PlaceSearch
                  label={placeholder}
                  onSelect={handleSelect}
                  includedRegionCodes={includedRegionCodes}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Search addresses, airports, stations or hotels</span>
                <button
                  type="button"
                  onClick={() => setIsManual(true)}
                  className="text-slate-600 hover:text-slate-900 hover:underline font-medium"
                >
                  Enter manually
                </button>
              </div>
            </div>
          )}

          {value?.address && (
            <div className="flex justify-end">
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

      {error && <p role="alert" className="text-xs text-red-600 font-medium">{error}</p>}

      <MapPickerModal
        isOpen={openMap}
        onClose={() => setOpenMap(false)}
        initialLocation={mapped ? { lat: value.lat!, lng: value.lng! } : undefined}
        onSelect={handleSelect}
        includedRegionCodes={includedRegionCodes}
      />
    </div>
  );
}
