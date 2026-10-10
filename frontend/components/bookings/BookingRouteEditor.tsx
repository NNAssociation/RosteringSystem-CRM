"use client";

import { MapboxMap } from "@/components/shared/MapboxMap";
import { Button } from "@/components/ui/button";
import { moveRoutePoint, scheduledRouteSeconds, tripRouteInput } from "@/lib/booking-route";
import { reverseGeocodeMapbox } from "@/lib/mapbox-geocoding";
import { cn } from "@/lib/utils";
import { useWorkflowApi } from "@/lib/workflow-api";
import type { StructuredLocation } from "@/types";
import type { BookingTrip, RouteCalculation } from "@/types/booking-workflow";
import {
  AlertCircle,
  Car,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  GripVertical,
  Maximize2,
  Milestone,
  Navigation,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LocationPicker } from "./LocationPicker";
import { StopAccessFields } from "./StopAccessFields";

export function BookingRouteEditor({
  trip,
  disabled,
  onChange,
  onPreview,
}: {
  trip: BookingTrip;
  disabled: boolean;
  onChange: (value: Partial<BookingTrip>) => void;
  onPreview: (value: RouteCalculation) => void;
}) {
  const api = useWorkflowApi();
  const [direction, setDirection] = useState<"outbound" | "return">("outbound");
  const [adding, setAdding] = useState<"STOP" | "VIA" | null>(null);
  const [newPoint, setNewPoint] = useState<StructuredLocation>({ address: "" });
  const [insertBefore, setInsertBefore] = useState<string>("destination");
  const [fit, setFit] = useState(0);
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState<Partial<BookingTrip>[]>([]);
  const [preview, setPreview] = useState<RouteCalculation | null>(trip.routeCalculation || null);
  const [previewKey, setPreviewKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callback = useRef(onPreview);
  useLayoutEffect(() => {
    callback.current = onPreview;
  }, [onPreview]);

  const input = tripRouteInput(trip);
  const key = JSON.stringify(input);
  const currentKey = useRef(key);
  useLayoutEffect(() => {
    currentKey.current = key;
  }, [key]);
  const sequence = useRef(0);

  const active =
    direction === "return" && trip.bookingType === "round_trip" ? "return" : "outbound";
  const points = active === "outbound" ? input.outboundItinerary : input.returnItinerary!;
  const stale = previewKey !== key || !!error || loading;

  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    const request = ++sequence.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Immediately mark the external route preview pending when its inputs change.
    setLoading(true);
    setError("");

    const timer = setTimeout(() => {
      api("bookings/route-preview", "POST", JSON.parse(key), false, controller.signal)
        .then((result) => {
          if (
            controller.signal.aborted ||
            request !== sequence.current ||
            currentKey.current !== key
          )
            return;
          setPreview(result);
          setPreviewKey(key);
          setLoading(false);
          callback.current(result);
        })
        .catch((e) => {
          if (
            controller.signal.aborted ||
            request !== sequence.current ||
            currentKey.current !== key
          )
            return;
          setError(e.message || "Unable to calculate route. Retry.");
          setLoading(false);
        });
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, key, retry, disabled]);

  const commit = (next: StructuredLocation[]) => {
    setHistory((h) => [
      ...h.slice(-29),
      {
        pickup: trip.pickup,
        dropoff: trip.dropoff,
        stops: trip.stops,
        outboundItinerary: trip.outboundItinerary,
        returnItinerary: trip.returnItinerary,
        returnItineraryConfirmed: trip.returnItineraryConfirmed,
      },
    ]);

    const bindLocation = (old: StructuredLocation, value: StructuredLocation) => ({
      ...old,
      address: value.address,
      lat: value.lat,
      lng: value.lng,
      placeId: value.placeId,
      ...(old.lat !== value.lat || old.lng !== value.lng ? { entrance: undefined } : {}),
    });

    const outbound =
      active === "outbound"
        ? next
        : [
            bindLocation(input.outboundItinerary[0], next[next.length - 1]),
            ...input.outboundItinerary.slice(1, -1),
            bindLocation(input.outboundItinerary[input.outboundItinerary.length - 1], next[0]),
          ];

    const returning =
      active === "return"
        ? next
        : input.returnItinerary?.map((p, i, all) =>
            i === 0
              ? bindLocation(p, outbound[outbound.length - 1])
              : i === all.length - 1
                ? bindLocation(p, outbound[0])
                : p,
          );

    onChange({
      pickup: outbound[0],
      dropoff: outbound[outbound.length - 1],
      outboundItinerary: outbound,
      stops: outbound.slice(1, -1).filter((p) => p.kind !== "VIA"),
      ...(returning ? { returnItinerary: returning, returnItineraryConfirmed: true } : {}),
    });
  };

  const updatePoint = (index: number, value: StructuredLocation) => {
    commit(points.map((p, i) => (i === index ? { ...value, id: p.id, kind: p.kind } : p)));
  };

  const addPoint = (value: StructuredLocation) => {
    if (!adding || points.length >= 22) return;
    const target = points.findIndex((p) => p.id === insertBefore);
    const index = target > 0 ? target : points.length - 1;
    commit([
      ...points.slice(0, index),
      { ...value, kind: adding, id: crypto.randomUUID(), dwellSeconds: 0 },
      ...points.slice(index),
    ]);
    setAdding(null);
  };

  const handleAddViaPoint = async ({ lat, lng }: { lat: number; lng: number }) => {
    if (disabled || points.length >= 22) return;

    let bestIdx = 1;
    if (points.length > 2) {
      let minDistance = Infinity;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (!p1.lat || !p1.lng || !p2.lat || !p2.lng) continue;
        const dx = p2.lng - p1.lng;
        const dy = p2.lat - p1.lat;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq === 0 ? 0 : ((lng - p1.lng) * dx + (lat - p1.lat) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = p1.lng + t * dx;
        const projY = p1.lat + t * dy;
        const distSq = (lng - projX) * (lng - projX) + (lat - projY) * (lat - projY);
        if (distSq < minDistance) {
          minDistance = distSq;
          bestIdx = i + 1;
        }
      }
    }

    const pointId = crypto.randomUUID();
    const newVia: StructuredLocation = {
      id: pointId,
      kind: "VIA",
      lat,
      lng,
      address: `Via Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      source: "MANUAL",
    };

    const nextPoints = [...points.slice(0, bestIdx), newVia, ...points.slice(bestIdx)];
    commit(nextPoints);

    try {
      const geo = await reverseGeocodeMapbox(lat, lng);
      if (geo?.address) {
        commit(nextPoints.map((p) => (p.id === pointId ? { ...p, address: geo.address } : p)));
      }
    } catch {
      // best-effort reverse geocode
    }
  };

  const handleMovePoint = async (id: string, value: { lat: number; lng: number }) => {
    const i = points.findIndex((p) => p.id === id);
    if (i < 0) return;
    if (points[i].entrance) {
      updatePoint(i, { ...points[i], entrance: { lat: value.lat, lng: value.lng } });
    } else {
      const isVia = points[i].kind === "VIA";
      const updated = {
        ...points[i],
        ...value,
        address: isVia
          ? `Via Point (${value.lat.toFixed(4)}, ${value.lng.toFixed(4)})`
          : points[i].address,
        placeId: undefined,
        entrance: undefined,
        source: "MANUAL" as const,
      };
      updatePoint(i, updated);

      if (isVia) {
        try {
          const geo = await reverseGeocodeMapbox(value.lat, value.lng);
          if (geo?.address) {
            updatePoint(i, { ...updated, address: geo.address });
          }
        } catch {
          // best-effort reverse geocode
        }
      }
    }
  };

  const snapshot = preview?.status === "VALID" ? preview : preview?.previous;
  const metrics = active === "outbound" ? snapshot?.outbound : snapshot?.return;
  const start =
    active === "outbound"
      ? `${trip.date}T${trip.startTime}`
      : `${trip.returnDate || trip.date}T${trip.returnTime}`;
  const end =
    active === "outbound"
      ? `${trip.endDate || trip.date}T${trip.endTime}`
      : `${trip.returnEndDate || trip.returnDate || trip.date}T${trip.returnEndTime}`;
  const scheduledSeconds = scheduledRouteSeconds(start, end, trip.timeZone);

  return (
    <div className="space-y-5">
      {/* Journey Direction Tabs & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {trip.bookingType === "round_trip" ? (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              role="tab"
              aria-label="Outbound"
              onClick={() => {
                setDirection("outbound");
                setAdding(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                active === "outbound"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              Outbound
            </button>
            <button
              type="button"
              role="tab"
              aria-label="Return"
              onClick={() => {
                setDirection("return");
                setAdding(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                active === "return"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              Return
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Navigation className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              One-Way Route Planning
            </span>
          </div>
        )}

        {/* Quick Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            aria-label="Add Passenger Stop"
            disabled={disabled || points.length >= 22}
            onClick={() => {
              setAdding("STOP");
              setNewPoint({ address: "" });
            }}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-9 shadow-sm"
          >
            <Plus size={14} /> Add Passenger Stop
          </Button>

          <Button
            type="button"
            aria-label="Add Via Point"
            disabled={disabled || points.length >= 22}
            onClick={() => {
              setAdding("VIA");
              setNewPoint({ address: "" });
            }}
            className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold h-9 shadow-sm"
          >
            <Milestone size={14} /> Add Via Point
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setFit((f) => f + 1)}
            className="gap-1.5 rounded-xl text-xs font-semibold h-9 border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <Maximize2 size={13} /> Fit Route
          </Button>

          {!!history.length && (
            <Button
              type="button"
              variant="outline"
              aria-label="Undo Last Change"
              disabled={disabled}
              onClick={() => {
                onChange(history[history.length - 1]);
                setHistory((h) => h.slice(0, -1));
                setAdding(null);
              }}
              className="gap-1.5 rounded-xl text-xs font-semibold h-9 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw size={13} /> Undo Last Change
            </Button>
          )}

          {active === "return" && (
            <Button
              type="button"
              variant="outline"
              aria-label="Copy outbound in reverse"
              disabled={disabled}
              onClick={() =>
                commit(
                  [...input.outboundItinerary].reverse().map((p) => ({
                    ...p,
                    entrance: p.entrance ? { ...p.entrance } : undefined,
                    id: crypto.randomUUID(),
                  })),
                )
              }
              className="gap-1.5 rounded-xl text-xs font-semibold h-9 border-slate-200 text-slate-700"
            >
              <CornerDownRight size={13} /> Copy outbound in reverse
            </Button>
          )}
        </div>
      </div>

      {points.length >= 22 && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
        >
          Maximum 20 intermediate points reached for this journey.
        </div>
      )}

      {/* Add Waypoint / Stop Card */}
      {adding && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm",
                  adding === "VIA" ? "bg-purple-600" : "bg-blue-600",
                )}
              >
                {adding === "VIA" ? "◇" : "●"}
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Add {adding === "VIA" ? "Route Waypoint (Via Point)" : "Passenger Stop"}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {adding === "VIA"
                    ? "Pass-through point with 0m dwell to shape the route path."
                    : "Scheduled pickup or dropoff point with dwell time."}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdding(null)}
              className="h-8 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Cancel
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Insert position:</span>
            <select
              className="h-8.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 shadow-2xs focus:border-blue-500 outline-none"
              value={insertBefore}
              onChange={(e) => setInsertBefore(e.target.value)}
            >
              <option value="destination">Before Destination</option>
              {points.slice(1, -1).map((p, i) => (
                <option key={p.id} value={p.id}>
                  Before Stop {i + 2}: {p.address || "Unnamed point"}
                </option>
              ))}
            </select>
          </div>

          <LocationPicker
            embedded
            label="New route point"
            placeholder="Search place, street, or highway"
            value={newPoint}
            onChange={setNewPoint}
          />

          <div className="flex justify-end gap-2 pt-1 border-t border-purple-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdding(null)}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              aria-label="Insert point"
              disabled={!newPoint.address}
              onClick={() => addPoint(newPoint)}
              className="bg-slate-900 hover:bg-black text-white rounded-xl text-xs h-9 px-5 font-semibold shadow-sm"
            >
              Insert point
            </Button>
          </div>
        </div>
      )}

      {/* Main Split Layout: Itinerary List & Interactive Map */}
      <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.3fr)]">
        {/* Left: Journey Points List */}
        <div
          className="space-y-3 max-h-[640px] overflow-y-auto pr-1 select-none"
          aria-label={`${active} journey points`}
        >
          {points.map((p, i) => {
            const isFirst = i === 0;
            const isLast = i === points.length - 1;
            const isVia = p.kind === "VIA";

            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-2xl border bg-white p-4 space-y-3.5 shadow-2xs transition-all hover:border-slate-300",
                  isFirst
                    ? "border-l-4 border-l-emerald-500 border-slate-200/90"
                    : isLast
                      ? "border-l-4 border-l-rose-500 border-slate-200/90"
                      : isVia
                        ? "border-l-4 border-l-purple-500 border-purple-200/90 bg-purple-50/25"
                        : "border-l-4 border-l-blue-500 border-slate-200/90",
                )}
                onDragOver={(e) => {
                  if (i > 0 && i < points.length - 1) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = points.findIndex(
                    (pt) => pt.id === e.dataTransfer.getData("text/route-point"),
                  );
                  if (!disabled && from > 0) commit(moveRoutePoint(points, from, i));
                }}
              >
                {/* Point Header Bar */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    draggable={!disabled && !isFirst && !isLast}
                    onDragStart={(e) => e.dataTransfer.setData("text/route-point", p.id!)}
                    className="flex items-center gap-2 cursor-grab active:cursor-grabbing min-w-0"
                  >
                    {!isFirst && !isLast && (
                      <GripVertical className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-2xs",
                        isFirst
                          ? "bg-emerald-600"
                          : isLast
                            ? "bg-rose-600"
                            : isVia
                              ? "bg-purple-600"
                              : "bg-blue-600",
                      )}
                    >
                      {isFirst ? "●" : isLast ? "■" : isVia ? "◇" : String(i + 1)}
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {isFirst
                        ? "1. Departure / Pickup"
                        : isLast
                          ? `${points.length}. Final Destination`
                          : isVia
                            ? `${i + 1}. Via Waypoint (Route Shaper)`
                            : `${i + 1}. Passenger Stop`}
                    </span>
                  </div>

                  {/* Ordering & Delete Actions */}
                  {!isFirst && !isLast && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Move point ${i + 1} up`}
                        disabled={i === 1}
                        onClick={() => commit(moveRoutePoint(points, i, i - 1))}
                        className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        title="Move Up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Move point ${i + 1} down`}
                        disabled={i === points.length - 2}
                        onClick={() => commit(moveRoutePoint(points, i, i + 1))}
                        className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        title="Move Down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove point ${i + 1}`}
                        onClick={() => commit(points.filter((_, n) => n !== i))}
                        className="h-7 w-7 p-0 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        title="Remove point"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Location Picker or Address Display */}
                {active === "return" && (isFirst || isLast) ? (
                  <p className="text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                    {p.address || "Linked to outbound booking destination"}
                  </p>
                ) : (
                  <LocationPicker
                    embedded
                    label={
                      isFirst ? "Departure Point" : isLast ? "Destination Point" : `Stop ${i + 1}`
                    }
                    value={p}
                    onChange={(v) => updatePoint(i, { ...p, ...v, entrance: undefined })}
                  />
                )}

                {/* Sub-details (Via note vs. Coach access notes & dwell) */}
                {isVia ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-100">
                    <Milestone className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <span>Pass through — no passenger stop.</span>
                    <span className="text-purple-600/80">
                      Drag on map anytime to reshape route.
                    </span>
                  </div>
                ) : (
                  <StopAccessFields stop={p} onChange={(v) => updatePoint(i, v)} />
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Mapbox Interactive Map & Live Metrics */}
        <div className="space-y-4">
          {/* Interactive Route Helper Banner */}
          <div className="flex items-center justify-between text-xs bg-blue-50/80 border border-blue-200/90 rounded-2xl px-4 py-2.5 shadow-2xs">
            <span className="flex items-center gap-2 font-medium text-blue-900">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-ping" />
              <span>
                <strong>Interactive Route:</strong> Drag the white handle on the route line or click
                anywhere on the route to bend it through custom roads.
              </span>
            </span>
            <span className="text-[11px] font-bold text-blue-700 bg-white border border-blue-200 px-2.5 py-1 rounded-full shadow-2xs shrink-0 ml-2">
              {points.filter((p) => p.kind === "VIA").length} custom waypoints
            </span>
          </div>

          {/* Map Viewport */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm">
            <MapboxMap
              key={active}
              editor
              fitVersion={fit}
              className="h-[520px]"
              points={points.flatMap((p, i) => {
                const c = p.kind === "VIA" ? p : p.entrance || p;
                return Number.isFinite(c.lat) &&
                  Number.isFinite(c.lng) &&
                  Math.abs(c.lat!) <= 90 &&
                  Math.abs(c.lng!) <= 180
                  ? [
                      {
                        id: p.id,
                        kind: p.kind,
                        lat: c.lat!,
                        lng: c.lng!,
                        label: `${i + 1}`,
                        title: `${p.kind === "VIA" ? "Via point" : "Passenger stop"}: ${p.address}`,
                      },
                    ]
                  : [];
              })}
              geometry={metrics?.geometry}
              onChoose={
                !disabled && adding
                  ? (p) =>
                      addPoint({
                        ...p,
                        address: `Map point (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`,
                        source: "MANUAL",
                      })
                  : undefined
              }
              onAddViaPoint={disabled ? undefined : handleAddViaPoint}
              onMove={disabled ? undefined : handleMovePoint}
            />
          </div>

          {/* Loading / Error States */}
          <div aria-live="polite">
            {loading && (
              <div className="flex items-center gap-2 text-xs text-blue-600 font-medium p-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Calculating road geometry & metrics…
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    {error}. Previous route totals may be outdated. Your points are saved.
                  </span>
                </div>
                {!loading && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRetry((n) => n + 1)}
                    className="h-7 text-xs rounded-lg"
                  >
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Structured Route Metrics Card */}
          {metrics && (
            <div
              className={cn(
                "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4",
                stale && !disabled ? "opacity-60" : "",
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Route Calculation Metrics
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Heavy Vehicle Profile
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Road Distance
                  </span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {(metrics.distanceMeters / 1000).toFixed(1)} km
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Coach Driving Time
                  </span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {Math.round(metrics.coachDrivingSeconds / 60)} min
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Passenger Dwell Time
                  </span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {Math.round(metrics.stopSeconds / 60)} min
                  </span>
                </div>

                <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                    Total Service Duration
                  </span>
                  <span className="text-base font-bold text-blue-900 font-mono">
                    {Math.round(metrics.serviceSeconds / 60)} min
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Includes coach heavy vehicle buffer (+18% driving margin).
                </span>
                {scheduledSeconds > 0 && metrics.serviceSeconds > scheduledSeconds && (
                  <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    Journey exceeds scheduled booking duration.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
