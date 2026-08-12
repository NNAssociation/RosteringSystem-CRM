"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, Check, Close, Search } from "@mui/icons-material";
import { Input } from "@/components/ui/input";
import { useGoogleMaps } from "@/providers/google-maps-provider";

declare global {
  interface Window {
    google: any;
  }
}

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: { lat: number; lng: number };
  onSelect: (location: { address: string; lat: number; lng: number; placeId?: string }) => void;
}

export function MapPickerModal({
  isOpen,
  onClose,
  initialLocation,
  onSelect,
}: MapPickerModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number } | null>(
    initialLocation || null
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<any>(null);
  const { isLoaded } = useGoogleMaps();

  useEffect(() => {
    const initMap = () => {
      if (isOpen && isLoaded && mapRef.current && !map && typeof window !== "undefined" && window.google) {
        const defaultPos = initialLocation || { lat: -33.8688, lng: 151.2093 };
        const newMap = new window.google.maps.Map(mapRef.current, {
          center: defaultPos,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const newMarker = new window.google.maps.Marker({
          position: defaultPos,
          map: newMap,
          draggable: true,
        });

        newMap.addListener("click", (e: any) => {
          if (e.latLng) {
            const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            newMarker.setPosition(pos);
            setSelectedPos(pos);
          }
        });

        newMarker.addListener("dragend", () => {
          const pos = newMarker.getPosition();
          if (pos) {
            setSelectedPos({ lat: pos.lat(), lng: pos.lng() });
          }
        });

        // Initialize Search Autocomplete
        if (searchInputRef.current) {
          const autocomp = new window.google.maps.places.Autocomplete(searchInputRef.current, {
            types: ["address"],
            componentRestrictions: { country: "AU" },
          });

          autocomp.addListener("place_changed", () => {
            const place = autocomp.getPlace();
            if (place.geometry && place.geometry.location) {
              const pos = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              };
              newMap.setCenter(pos);
              newMap.setZoom(17);
              newMarker.setPosition(pos);
              setSelectedPos(pos);
            }
          });
          setAutocomplete(autocomp);
        }

        setMap(newMap);
        setMarker(newMarker);
        return true;
      }
      return false;
    };

    if (isOpen && !map && !initMap()) {
      const interval = setInterval(() => {
        if (initMap()) clearInterval(interval);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isOpen, map, initialLocation, isLoaded]);

  const handleConfirm = async () => {
    if (selectedPos && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      try {
        const response = await geocoder.geocode({ location: selectedPos });
        if (response.results[0]) {
          const result = response.results[0];
          onSelect({
            address: result.formatted_address,
            lat: selectedPos.lat,
            lng: selectedPos.lng,
            placeId: result.place_id,
          });
          onClose();
        }
      } catch (error) {
        console.error("Geocoding failed:", error);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-none">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MapIcon className="text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Select Location</DialogTitle>
              <p className="text-xs text-slate-400">Click on the map or drag the pin to select a location</p>
            </div>
          </div>
        </DialogHeader>

        <div className="h-[400px] w-full relative">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-[400px] group">
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                <Search style={{ fontSize: "20px" }} />
              </div>
              <Input
                ref={searchInputRef}
                placeholder="Search location..."
                className="pl-10 pr-4 h-12 text-sm font-medium border-none bg-white/95 backdrop-blur-md rounded-2xl shadow-xl ring-1 ring-slate-200/50 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
          <div ref={mapRef} className="w-full h-full" />
        </div>

        <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedPos} className="rounded-xl gap-2">
            <Check style={{ fontSize: "18px" }} />
            Confirm Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
