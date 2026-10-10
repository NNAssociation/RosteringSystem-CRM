"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StructuredLocation } from "@/types";
import { Bus, ChevronDown, Clock, Crosshair, FileText } from "lucide-react";
import { useState } from "react";

export function StopAccessFields({
  stop,
  onChange,
}: {
  stop: StructuredLocation;
  onChange: (s: StructuredLocation) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dwellMinutes = Math.round((stop.dwellSeconds || 0) / 60);
  const hasAccessNotes = !!stop.accessNotes?.trim();
  const hasEntranceOverride = !!stop.entrance;
  const hasCustomizations = dwellMinutes > 0 || hasAccessNotes || hasEntranceOverride;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 transition-all">
      {/* Toggle Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100/60 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bus className="h-3.5 w-3.5 text-blue-600" />
          <span>Coach access, dwell time & entrance</span>
          {hasCustomizations && (
            <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              {dwellMinutes > 0 && `${dwellMinutes}m dwell`}
              {hasAccessNotes && (dwellMinutes > 0 ? " • notes" : "notes")}
              {hasEntranceOverride && " • custom gate"}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180 text-slate-700",
          )}
        />
      </button>

      {/* Expanded Options Panel */}
      {isOpen && (
        <div className="space-y-3.5 border-t border-slate-200/80 p-3.5 sm:p-4 text-xs animate-in fade-in-50 duration-150">
          <div className="grid gap-3.5 sm:grid-cols-2">
            {/* Dwell Time */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-bold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>Passenger Dwell Time (minutes)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={dwellMinutes}
                  onChange={(e) =>
                    onChange({
                      ...stop,
                      dwellSeconds: Math.max(0, Math.round(Number(e.target.value) * 60)),
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="0"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 font-medium text-xs">
                  mins
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Boarding / alighting pause added to total service calculation.
              </p>
            </div>

            {/* Coach Access Notes */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-bold text-slate-700">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>Coach Access & Bay Notes</span>
              </label>
              <input
                maxLength={2000}
                value={stop.accessNotes || ""}
                onChange={(e) => onChange({ ...stop, accessNotes: e.target.value })}
                placeholder="e.g. Bus Bay 4, Entry Gate B, height restriction"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="text-[11px] text-slate-400">
                Printed on driver run sheets and dispatch tickets.
              </p>
            </div>
          </div>

          {/* Coach Entrance Override */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Crosshair className="h-3.5 w-3.5 text-purple-600" />
                <span>Dedicated Coach Entrance Override</span>
              </div>
              {stop.entrance && (
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  Custom Entrance Set
                </span>
              )}
            </div>

            {!stop.entrance ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  If the coach loading zone or security gate differs from the street address pin.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)}
                  onClick={() =>
                    onChange({ ...stop, entrance: { lat: stop.lat!, lng: stop.lng! } })
                  }
                  className="rounded-xl text-xs font-semibold h-8 border-purple-200 text-purple-700 hover:bg-purple-50 shrink-0"
                >
                  <Crosshair className="h-3 w-3 mr-1" /> Set Coach Entrance
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Entrance Latitude
                    </span>
                    <input
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      value={stop.entrance.lat}
                      onChange={(e) => {
                        if (e.target.value !== "") {
                          onChange({
                            ...stop,
                            entrance: { ...stop.entrance!, lat: Number(e.target.value) },
                          });
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono font-medium"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Entrance Longitude
                    </span>
                    <input
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      value={stop.entrance.lng}
                      onChange={(e) => {
                        if (e.target.value !== "") {
                          onChange({
                            ...stop,
                            entrance: { ...stop.entrance!, lng: Number(e.target.value) },
                          });
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange({ ...stop, entrance: undefined })}
                    className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    Reset to Main Address
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
