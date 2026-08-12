"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { LocationOn, MyLocation } from "@mui/icons-material";
import type { StructuredLocation } from "@/types";
import { cn } from "@/lib/utils";
import { MapPickerModal } from "@/components/shared/MapPickerModal";
import { useGoogleMaps } from "@/providers/google-maps-provider";

declare global {
  interface Window {
    google: any;
  }
}

interface LocationPickerProps {
  label: string;
  value: StructuredLocation;
  onChange: (location: StructuredLocation) => void;
  error?: string;
  placeholder?: string;
}

export function LocationPicker({
  label,
  value,
  onChange,
  error,
  placeholder = "Enter address...",
}: LocationPickerProps) {
  const [isMapModalOpen, setIsMapModalOpen] = React.useState(false);
  const autocompleteRef = React.useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = React.useState<any>(null);
  const { isLoaded } = useGoogleMaps();

  React.useEffect(() => {
    const initAutocomplete = () => {
      if (isLoaded && typeof window !== "undefined" && window.google && autocompleteRef.current && !autocomplete) {
        const autocomp = new window.google.maps.places.Autocomplete(autocompleteRef.current, {
          types: ["address"],
          componentRestrictions: { country: "AU" },
        });

        autocomp.addListener("place_changed", () => {
          const place = autocomp.getPlace();
          if (place.geometry && place.geometry.location) {
            onChange({
              address: place.formatted_address || place.name || "",
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              placeId: place.place_id,
            });
          }
        });

        setAutocomplete(autocomp);
        return true;
      }
      return false;
    };

    if (!initAutocomplete()) {
      const interval = setInterval(() => {
        if (initAutocomplete()) clearInterval(interval);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [autocomplete, onChange, isLoaded]);

  const handleAddressChange = (address: string) => {
    onChange({ ...value, address });
  };

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative group">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors">
          <LocationOn style={{ fontSize: "18px" }} />
        </div>
        <Input
          ref={autocompleteRef}
          value={value.address}
          onChange={(e) => handleAddressChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "pl-10 pr-12 h-11 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl",
            "transition-all focus:ring-2 focus:ring-primary/10 focus:border-primary/30",
            error && "border-red-300 focus:ring-red-100 focus:border-red-300"
          )}
        />
        {/* Map Picker Trigger */}
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors"
          title="Select on map"
          onClick={() => setIsMapModalOpen(true)}
        >
          <MyLocation style={{ fontSize: "16px" }} />
        </button>
      </div>

      <MapPickerModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        initialLocation={value.lat && value.lng ? { lat: value.lat, lng: value.lng } : undefined}
        onSelect={(loc) => onChange(loc)}
      />



      {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
    </div>
  );
}
