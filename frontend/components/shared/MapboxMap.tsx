"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Point = {
  lat: number;
  lng: number;
  label?: string;
  id?: string;
  kind?: "STOP" | "VIA";
  title?: string;
};

type Props = {
  points?: Point[];
  geometry?: { coordinates: number[][] | [number, number][] } | null;
  className?: string;
  onChoose?: (point: { lat: number; lng: number }) => void;
  editor?: boolean;
  fitVersion?: number;
  onMove?: (id: string, point: { lat: number; lng: number }) => void;
  onAddViaPoint?: (point: { lat: number; lng: number }) => void;
};

export function MapboxMap({
  points = [],
  geometry,
  className = "h-96",
  onChoose,
  editor = false,
  fitVersion = 0,
  onMove,
  onAddViaPoint,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const latest = useRef({ points, geometry, fitVersion, onMove, onAddViaPoint });
  useLayoutEffect(() => {
    latest.current = { points, geometry, fitVersion, onMove, onAddViaPoint };
  }, [points, geometry, fitVersion, onMove, onAddViaPoint]);
  const choose = useRef(onChoose);
  useLayoutEffect(() => {
    choose.current = onChoose;
  }, [onChoose]);
  const update = useRef<(() => void) | null>(null);

  const key = JSON.stringify([points, geometry, fitVersion, !!onMove, !!onAddViaPoint]);
  const interactive = !editor && !!onChoose;

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token || !container.current) return;
    let fitted = false,
      lastFit = -1;
    let disposed = false,
      map: import("mapbox-gl").Map | undefined;
    let observer: ResizeObserver | undefined;
    let markers: import("mapbox-gl").Marker[] = [];

    void import("mapbox-gl")
      .then(({ default: mb }) => {
        if (disposed || !container.current) return;
        map = new mb.Map({
          container: container.current,
          accessToken: token,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [151.2093, -33.8688],
          zoom: 11,
        });

        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => map?.resize());
          observer.observe(container.current);
        }

        map.addControl(new mb.NavigationControl(), "top-right");

        map.on("error", () => {
          if (!disposed)
            setError(
              "Mapbox could not load map data. Check your connection, token and allowed website URLs.",
            );
        });

        map.on("load", () => {
          if (disposed || !map) return;
          setError("");

          if (editor) {
            map.on("click", (e) => {
              // Ignore clicks that originated on interactive layers or markers
              choose.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            });
          }

          const singleMarker = interactive
            ? new mb.Marker({ draggable: true, color: "#047857" })
            : null;
          if (singleMarker) {
            map.on("click", (e) => {
              singleMarker.setLngLat(e.lngLat).addTo(map!);
              choose.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            });
            singleMarker.on("dragend", () => {
              const p = singleMarker.getLngLat();
              choose.current?.({ lat: p.lat, lng: p.lng });
            });
          }

          update.current = () => {
            if (disposed || !map) return;
            const { points: pins, geometry: line, onAddViaPoint: addVia } = latest.current;
            markers.forEach((m) => m.remove());
            markers = [];
            const bounds = new mb.LngLatBounds();

            // Render all pins
            pins.forEach((p, index) => {
              if (!interactive) {
                const isFirst = index === 0;
                const isLast = index === pins.length - 1 && pins.length > 1;
                const isVia = p.kind === "VIA";

                const wrapper = document.createElement("div");
                wrapper.className = "group relative flex items-center justify-center";

                const badge = document.createElement("div");
                badge.title = (p.title || "Location") + (editor ? " (Drag to reposition)" : "");

                if (isVia) {
                  badge.className =
                    "h-6 w-6 rounded-md bg-purple-600 border-2 border-white text-white rotate-45 flex items-center justify-center text-[10px] font-black shadow-md " +
                    (editor
                      ? "cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                      : "");
                  badge.innerHTML = `<span class="-rotate-45 block leading-none">◇</span>`;
                } else {
                  badge.textContent = p.label || String(index + 1);
                  badge.className =
                    "h-7 w-7 rounded-full text-white border-2 border-white flex items-center justify-center text-xs font-bold shadow-md " +
                    (isFirst ? "bg-emerald-600 " : isLast ? "bg-rose-600 " : "bg-blue-600 ") +
                    (editor
                      ? "cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                      : "");
                }

                wrapper.appendChild(badge);

                // Add popup tooltip on hover
                const tooltip = document.createElement("div");
                tooltip.className =
                  "absolute -top-7 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50";
                tooltip.textContent = isFirst
                  ? "Pickup Departure"
                  : isLast
                    ? "Final Destination"
                    : isVia
                      ? "Via Point (Route Shaper)"
                      : `Stop ${p.label || index + 1}`;
                wrapper.appendChild(tooltip);

                const pin = new mb.Marker({
                  element: wrapper,
                  draggable: editor && !!latest.current.onMove,
                })
                  .setLngLat([p.lng, p.lat])
                  .addTo(map!);

                pin.on("dragend", () => {
                  const loc = pin.getLngLat();
                  if (p.id) latest.current.onMove?.(p.id, { lat: loc.lat, lng: loc.lng });
                });

                markers.push(pin);
              }
              bounds.extend([p.lng, p.lat]);
            });

            // Clean up existing route layers
            if (map.getLayer("coach-route-hitbox")) map.removeLayer("coach-route-hitbox");
            if (map.getLayer("coach-route-glow")) map.removeLayer("coach-route-glow");
            if (map.getLayer("coach-route")) map.removeLayer("coach-route");
            if (map.getSource("coach-route")) map.removeSource("coach-route");

            // Draw route line
            if (line && line.coordinates.length >= 2) {
              map.addSource("coach-route", {
                type: "geojson",
                data: { type: "Feature", properties: {}, geometry: line },
              });

              // Subtle glowing underlay
              map.addLayer({
                id: "coach-route-glow",
                type: "line",
                source: "coach-route",
                paint: { "line-color": "#3b82f6", "line-width": 8, "line-opacity": 0.25 },
              });

              // Primary route polyline
              map.addLayer({
                id: "coach-route",
                type: "line",
                source: "coach-route",
                paint: { "line-color": "#2563eb", "line-width": 5 },
              });

              line.coordinates.forEach((p) => bounds.extend([p[0], p[1]]));

              // Wider invisible hitbox for 1-click waypoint insertion
              if (editor && addVia) {
                map.addLayer({
                  id: "coach-route-hitbox",
                  type: "line",
                  source: "coach-route",
                  paint: { "line-color": "#2563eb", "line-width": 24, "line-opacity": 0 },
                });

                map.on("mouseenter", "coach-route-hitbox", () => {
                  if (map) map.getCanvas().style.cursor = "pointer";
                });
                map.on("mouseleave", "coach-route-hitbox", () => {
                  if (map) map.getCanvas().style.cursor = "";
                });
                map.on("click", "coach-route-hitbox", (e) => {
                  if (e.lngLat) {
                    addVia({ lat: e.lngLat.lat, lng: e.lngLat.lng });
                  }
                });

                // Draggable Route Bend Handle in the midpoint of the route
                const midIdx = Math.floor(line.coordinates.length / 2);
                const midCoord = line.coordinates[midIdx];
                if (midCoord) {
                  const bendEl = document.createElement("div");
                  bendEl.className =
                    "group relative flex items-center justify-center cursor-grab active:cursor-grabbing";
                  bendEl.innerHTML = `
                    <div class="h-6 w-6 rounded-full bg-white border-2 border-blue-600 shadow-xl flex items-center justify-center transition-transform hover:scale-125">
                      <div class="h-2 w-2 rounded-full bg-blue-600 animate-ping opacity-75"></div>
                      <div class="absolute h-2 w-2 rounded-full bg-blue-600"></div>
                    </div>
                    <div class="absolute -top-7 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow pointer-events-none transition-opacity">
                      ⚪ Drag to change route
                    </div>
                  `;
                  const bendMarker = new mb.Marker({ element: bendEl, draggable: true })
                    .setLngLat([midCoord[0], midCoord[1]])
                    .addTo(map!);

                  bendMarker.on("dragend", () => {
                    const pos = bendMarker.getLngLat();
                    addVia({ lat: pos.lat, lng: pos.lng });
                  });
                  markers.push(bendMarker);
                }
              }
            }

            // Auto-fit route bounds
            if (
              !bounds.isEmpty() &&
              (!editor || !fitted || lastFit !== latest.current.fitVersion)
            ) {
              map.fitBounds(bounds, { padding: 45, maxZoom: 16, duration: 0 });
              fitted = true;
              lastFit = latest.current.fitVersion;
            }

            if (singleMarker) {
              if (pins[0]) singleMarker.setLngLat([pins[0].lng, pins[0].lat]).addTo(map);
              else singleMarker.remove();
            }
          };

          update.current();
        });
      })
      .catch(() => {
        if (!disposed) setError("Mapbox could not start. Check browser WebGL support and reload.");
      });

    return () => {
      disposed = true;
      update.current = null;
      observer?.disconnect();
      markers.forEach((m) => m.remove());
      map?.remove();
    };
  }, [interactive, editor]);

  useEffect(() => {
    update.current?.();
  }, [key]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    return (
      <p role="alert" className="p-4 rounded-xl bg-amber-50 text-amber-800 text-xs">
        Mapbox is not configured. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to the frontend environment
        and restart.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={container}
        className={className + " w-full overflow-hidden rounded-xl bg-slate-100"}
        aria-label="Mapbox map"
      />
      {error && (
        <p role="alert" className="text-xs text-amber-800">
          {error}
        </p>
      )}
    </div>
  );
}
