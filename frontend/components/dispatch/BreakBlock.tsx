"use client";

import React from "react";
import { Coffee } from "lucide-react";

interface BreakBlockProps {
  leftPx: number;
  widthPx: number;
  durationMins: number;
}

export function BreakBlock({ leftPx, widthPx, durationMins }: BreakBlockProps) {
  return (
    <div
      className="absolute top-2.5 h-[34px] z-10 rounded-md border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-xs overflow-hidden flex items-center px-2 pointer-events-none select-none transition-all"
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.1) 8px, transparent 8px, transparent 16px)",
      }}
      title={`Driver Break (${durationMins} mins)`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Coffee className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" strokeWidth={2.5} />
        {widthPx > 45 && (
          <span className="text-[10px] font-extrabold uppercase tracking-tight text-amber-900 dark:text-amber-200 truncate">
            Break {durationMins}m
          </span>
        )}
      </div>
    </div>
  );
}
