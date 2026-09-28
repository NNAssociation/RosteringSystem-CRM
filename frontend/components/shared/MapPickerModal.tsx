"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlaceSearch } from "./PlaceSearch";
import { useGoogleMaps } from "@/providers/google-maps-provider";
import type { StructuredLocation } from "@/types";

type Point = { lat: number; lng: number };
type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: Point;
  onSelect: (location: { address: string; lat: number; lng: number; placeId?: string }) => void;
  includedRegionCodes?: string[];
};
export function MapPickerModal(props: Props) {
  return <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Choose location</DialogTitle></DialogHeader>{props.isOpen && <MapSelection {...props} />}</DialogContent></Dialog>;
}
function MapSelection({ initialLocation, onSelect, onClose, includedRegionCodes }: Props) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const initial = useRef(initialLocation);
  const [selected, setSelected] = useState<StructuredLocation | null>(initialLocation ? { ...initialLocation, address: "" } : null);
  const map = useRef<any>(null), marker = useRef<any>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const { isLoaded, error: loaderError } = useGoogleMaps();
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (!element || !isLoaded) return;
    let disposed = false;
    const listeners: any[] = [];
    void window.google.maps.importLibrary("marker").then(({ AdvancedMarkerElement }: any) => {
      if (disposed) return;
      const center = initial.current || { lat: -33.8688, lng: 151.2093 };
      map.current = new window.google.maps.Map(element, { center, zoom: 14, mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID", mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
      marker.current = new AdvancedMarkerElement({ map: map.current, position: initial.current, gmpDraggable: true, title: "Selected location" });
      listeners.push(map.current.addListener("click", (event: any) => { if (event.latLng) { const point = event.latLng.toJSON(); marker.current.position = point; setSelected({ ...point, address: "" }); setError(""); } }));
      listeners.push(marker.current.addListener("dragend", () => { const pos = marker.current.position; setSelected({ lat: typeof pos.lat === "function" ? pos.lat() : pos.lat, lng: typeof pos.lng === "function" ? pos.lng() : pos.lng, address: "" }); setError(""); }));
    }).catch(() => { if (!disposed) setError("The map could not load. Check Google Maps configuration."); });
    return () => { disposed = true; listeners.forEach(l => l.remove()); if (marker.current) marker.current.map = null; map.current = null; marker.current = null; };
  }, [element, isLoaded]);
  function choose(location: StructuredLocation) {
    setSelected(location); setError("");
    if (Number.isFinite(location.lat) && Number.isFinite(location.lng)) { const point = { lat: location.lat, lng: location.lng }; map.current?.panTo(point); map.current?.setZoom(17); if (marker.current) marker.current.position = point; }
  }
  async function confirm() {
    if (!selected || !Number.isFinite(selected.lat) || !Number.isFinite(selected.lng) || busy) return;
    setBusy(true); setError("");
    try {
      let location = selected;
      if (!location.address) {
        const result = await new window.google.maps.Geocoder().geocode({ location: { lat: location.lat, lng: location.lng } });
        if (!result.results?.[0]) throw new Error("No address");
        location = { ...location, address: result.results[0].formatted_address, placeId: result.results[0].place_id };
      }
      if (!alive.current) return;
      onSelect({ ...location, lat: location.lat!, lng: location.lng! }); onClose();
    } catch { if (alive.current) setError("Could not find an address for that point. Move the pin or choose a search result, then retry."); }
    finally { if (alive.current) setBusy(false); }
  }
  return <div className="space-y-3"><p className="text-sm text-slate-500">Search a place, click the map, or drag the pin. Confirm to update the booking.</p><fieldset disabled={busy}><PlaceSearch onSelect={choose} includedRegionCodes={includedRegionCodes} /></fieldset><div className={`h-[360px] rounded-lg border bg-slate-50 ${busy ? "pointer-events-none" : ""}`} ref={setElement} />{selected && <p className="text-sm text-slate-600">{selected.address || `Selected point: ${selected.lat?.toFixed(5)}, ${selected.lng?.toFixed(5)}`}</p>}{(error || loaderError) && <p role="alert" className="text-sm text-red-600">{error || loaderError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={confirm} disabled={!selected || busy || !isLoaded}>{busy ? "Finding address…" : "Use this location"}</Button></div></div>;
}
