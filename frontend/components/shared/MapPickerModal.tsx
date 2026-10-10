"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mapPoint } from "@/lib/map-locations";
import { reverseGeocodeMapbox } from "@/lib/mapbox-geocoding";
import type { StructuredLocation } from "@/types";
import { Check, Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MapboxMap } from "./MapboxMap";
import { PlaceSearch } from "./PlaceSearch";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: StructuredLocation;
  onSelect: (location: StructuredLocation) => void;
  includedRegionCodes?: string[];
};

export function MapPickerModal(props: Props) {
  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <MapPin className="text-blue-600 h-5 w-5" />
            <span>Select Location on Map</span>
          </DialogTitle>
        </DialogHeader>
        {props.isOpen && <MapSelection {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function MapSelection({ initialLocation, onSelect, onClose, includedRegionCodes }: Props) {
  const [selected, setSelected] = useState<StructuredLocation | null>(
    initialLocation && mapPoint(initialLocation)
      ? { ...initialLocation, ...mapPoint(initialLocation), entrance: undefined }
      : null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(initialLocation && mapPoint(initialLocation));
  const version = useRef(0);

  useEffect(() => {
    return () => {
      version.current++;
    };
  }, []);

  function choose(location: StructuredLocation) {
    version.current++;
    setError("");
    setSelected(location);
  }

  async function handleMapChoose(p: { lat: number; lng: number }) {
    const reqId = ++version.current;
    setBusy(true);
    setError("");
    setFocus(p);
    setSelected({ ...p, address: "Looking up street address...", source: "MAPBOX" });

    try {
      const geo = await reverseGeocodeMapbox(p.lat, p.lng);
      if (reqId === version.current) {
        if (geo) {
          setSelected(geo);
        } else {
          setSelected({
            ...p,
            address: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
            source: "MANUAL",
          });
        }
      }
    } catch (e: any) {
      if (reqId === version.current) {
        setSelected({
          ...p,
          address: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
          source: "MANUAL",
        });
      }
    } finally {
      if (reqId === version.current) {
        setBusy(false);
      }
    }
  }

  const point = selected ? mapPoint(selected) : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Search for an address below or click anywhere on the map to automatically pin and resolve
        the bus pickup/drop-off point.
      </p>

      <PlaceSearch
        includedRegionCodes={includedRegionCodes}
        onSelect={(l) => {
          choose(l);
          const pt = mapPoint(l);
          if (pt) setFocus(pt);
        }}
      />

      <div className="rounded-xl overflow-hidden border border-slate-200">
        <MapboxMap
          className="h-[340px] w-full"
          points={focus ? [focus] : []}
          onChoose={handleMapChoose}
        />
      </div>

      {point && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Selected Point Coordinates
            </span>
            <span className="text-xs font-mono text-slate-600 bg-white px-2 py-0.5 rounded border">
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </span>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">
              Resolved Address / Description
            </span>
            <div className="relative mt-1">
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={selected?.address || ""}
                onChange={(e) => choose({ ...selected!, address: e.target.value })}
                placeholder="Street address..."
              />
              {busy && (
                <div className="absolute right-3 top-2.5 text-blue-600 animate-spin">
                  <Loader2 size={16} />
                </div>
              )}
            </div>
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-amber-700 font-medium">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!point || !selected?.address?.trim() || busy}
          onClick={() => {
            if (selected) {
              onSelect(selected);
              onClose();
            }
          }}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-semibold"
        >
          <Check size={16} />
          Use this location
        </Button>
      </div>
    </div>
  );
}
