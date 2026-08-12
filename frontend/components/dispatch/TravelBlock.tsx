"use client";

import React from "react";
import { Navigation, AlertTriangle } from "lucide-react";

interface TravelBlockProps {
  /** px offset from timeline start */
  leftPx: number;
  /** width in px (estimated travel duration) */
  widthPx: number;
  /** estimated travel minutes — shown as label */
  estimatedMins: number;
  /** when true, renders in red — travel time is insufficient */
  isConflict?: boolean;
  /** travel distance in km — shown in tooltip */
  distanceKm?: number;
}

/**
 * Visual travel/transit block rendered BEFORE a job block.
 * Represents the travel leg between depot/previous-job and the next pickup.
 * Sits at z-10, above DutySpanOverlay (z-0) but below AssignmentBlock (z-20).
 */
export function TravelBlock({ leftPx, widthPx, estimatedMins, isConflict, distanceKm }: TravelBlockProps) {
  if (widthPx < 4) return null;

  const showLabel = widthPx >= 32;

  const colors = isConflict
    ? {
        bg: "bg-rose-400/25",
        border: "border-rose-500/70",
        stripe: "#f87171",
        icon: <AlertTriangle className="h-2.5 w-2.5 text-rose-600 flex-shrink-0" strokeWidth={2.5} />,
        text: "text-rose-700 dark:text-rose-400",
      }
    : {
        bg: "bg-sky-400/20",
        border: "border-sky-400/60",
        stripe: "#38bdf8",
        icon: <Navigation className="h-2.5 w-2.5 text-sky-500 flex-shrink-0" strokeWidth={2.5} />,
        text: "text-sky-600",
      };

  const tooltipText = distanceKm
    ? `Travel: ${estimatedMins} min · ${distanceKm.toFixed(1)} km`
    : `Travel: ${estimatedMins} min`;

  return (
    <div
      className="absolute top-[10px] bottom-[10px] z-10"
      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
      title={tooltipText}
    >
      <div
        className={`relative h-full rounded-md border border-dashed flex items-center justify-center gap-0.5 overflow-hidden ${colors.bg} ${colors.border}`}
      >
        {/* Diagonal stripe overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `repeating-linear-gradient(-45deg, ${colors.stripe} 0, ${colors.stripe} 1px, transparent 0, transparent 50%)`,
            backgroundSize: "6px 6px",
          }}
        />

        {showLabel && (
          <div className="relative flex items-center gap-0.5 z-10">
            {colors.icon}
            <span className={`text-[9px] font-black uppercase tracking-tight leading-none ${colors.text}`}>
              {estimatedMins}m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
