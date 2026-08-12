import React from "react";
import { startOfDay, differenceInMinutes, parseISO } from "date-fns";
import { TIMELINE_START_HOUR, PIXELS_PER_MINUTE } from "./DriverTimelineGrid";

interface DutySpanOverlayProps {
  startTime: string; // ISO string
  endTime: string;   // ISO string
  baseDate: Date;
  scale?: number;
}

export function DutySpanOverlay({ startTime, endTime, baseDate, scale = PIXELS_PER_MINUTE }: DutySpanOverlayProps) {
  const start = parseISO(startTime);
  const end = parseISO(endTime);
  
  // For Weekly view, duty span is relative to the start of THAT SPECIFIC DAY (00:00)
  // But wait, the parent passes 'left' relative to the day column.
  // Actually, in Weekly mode, I'm rendering multiple columns, so 00:00 of each day is the reference.
  const referenceTime = new Date(baseDate);
  referenceTime.setHours(0, 0, 0, 0);

  // However, in Daily view, the timeline might start at 07:00.
  // If scale is PIXELS_PER_MINUTE (Daily), we use TIMELINE_START_HOUR.
  const actualRef = (scale === PIXELS_PER_MINUTE) 
    ? startOfDay(baseDate).setHours(TIMELINE_START_HOUR, 0, 0, 0)
    : startOfDay(baseDate).getTime();

  const startDiffMinutes = differenceInMinutes(start, actualRef);
  const endDiffMinutes = differenceInMinutes(end, actualRef);

  const leftOffset = Math.max(0, startDiffMinutes * scale);
  const width = Math.max(0, (endDiffMinutes - startDiffMinutes) * scale);

  return (
    <div
      className="absolute top-0 bottom-0 bg-amber-400/15 border-l-2 border-r-2 border-amber-500/40 pointer-events-none z-0"
      style={{
        left: `${leftOffset}px`,
        width: `${width}px`,
      }}
    >
      {/* Subtle inner glow on left border */}
      <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-amber-400/20 to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-amber-400/20 to-transparent" />
    </div>
  );
}
