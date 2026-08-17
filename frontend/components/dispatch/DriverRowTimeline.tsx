"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { AssignmentBlock } from "./assignment-block";
import { TravelBlock } from "./TravelBlock";
import { BreakBlock } from "./BreakBlock";
import { differenceInMinutes, startOfDay, format, startOfWeek, addDays } from "date-fns";
import { TIMELINE_START_HOUR, PIXELS_PER_MINUTE } from "./DriverTimelineGrid";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DutySpanOverlay } from "./DutySpanOverlay";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { openDutySpanModal } from "@/store/dispatchUI.slice";
import { cn } from "@/lib/utils";

/** Default travel estimate in minutes when no previous context is available */
const DEFAULT_TRAVEL_MINS = 15;

/**
 * Calculate travel block for an assignment.
 * Uses real travel data from the backend (travelToMinutes) when available,
 * otherwise falls back to DEFAULT_TRAVEL_MINS.
 * Returns { leftPx, widthPx, estimatedMins } or null if block would be invisible.
 */
function calcTravelBlock(
  assignment: any,
  sortedAssignments: any[],
  index: number,
  referenceMs: number,
  scale: number,
  dutySpan?: any
): { leftPx: number; widthPx: number; estimatedMins: number; isConflict?: boolean } | null {
  const jobStart = new Date(assignment.scheduledStart).getTime();

  // Previous boundary: end of previous assignment
  let prevBoundaryMs: number | null = null;
  if (index > 0) {
    const prev = sortedAssignments[index - 1];
    if (prev?.scheduledEnd) prevBoundaryMs = new Date(prev.scheduledEnd).getTime();
  }

  // Use real travel data from backend if available and positive, otherwise default to 15 mins
  const realTravelMins = assignment.travelToMinutes;
  let estimatedMins = (realTravelMins && Number(realTravelMins) > 0) ? Number(realTravelMins) : DEFAULT_TRAVEL_MINS;

  // Cap to available gap if there's a previous boundary
  let isConflict = false;
  if (prevBoundaryMs !== null) {
    const gapMins = (jobStart - prevBoundaryMs) / 60000;
    if (gapMins <= 0) return null; // overlapping, skip
    if (estimatedMins > gapMins) {
      isConflict = true; // travel time exceeds available gap
      estimatedMins = Math.max(5, Math.floor(gapMins));
    }
  }

  const travelStartMs = jobStart - estimatedMins * 60000;
  let travelStartMins = (travelStartMs - referenceMs) / 60000;
  let visibleMins = estimatedMins;

  if (travelStartMins < 0) {
    visibleMins = (jobStart - referenceMs) / 60000;
    if (visibleMins <= 0) return null;
    travelStartMins = 0;
  }

  const leftPx = travelStartMins * scale;
  const widthPx = Math.max(12, visibleMins * scale);

  return { leftPx, widthPx, estimatedMins, isConflict };
}

interface DriverRowTimelineProps {
  driver: any;
  assignments: any[];
  baseDate: Date;
  isSelected?: boolean;
  onToggleSelect?: (driverId: number) => void;
  isActive?: boolean;
  onRowClick?: () => void;
  onAssignmentClick?: (assignment: any) => void;
  viewMode?: string;
}

export function DriverRowTimeline({ 
  driver, 
  assignments, 
  baseDate, 
  isSelected, 
  onToggleSelect,
  isActive,
  onRowClick,
  onAssignmentClick,
  viewMode
}: DriverRowTimelineProps) {
  const dispatch = useDispatch();
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setCurrentTime(new Date());
  }, []);

  const formattedDate = format(baseDate, "yyyy-MM-dd");
  const dutySpans = useSelector((state: RootState) => state.dispatchUI.dutySpans);
  
  // Weekly data prep - MOVE UP to avoid initialization error
  const startOfThisWeek = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekDays = React.useMemo(() => 
    Array.from({ length: 7 }, (_, i) => addDays(startOfThisWeek, i)),
    [startOfThisWeek]
  );

  const dutySpan = dutySpans[`${driver.id}-${formattedDate}`];

  const dutySpanByDate = React.useMemo(() => {
    const map: Record<string, any> = {};
    weekDays.forEach(day => {
      const dStr = format(day, "yyyy-MM-dd");
      const ds = dutySpans[`${driver.id}-${dStr}`];
      if (ds) map[dStr] = ds;
    });
    return map;
  }, [dutySpans, weekDays, driver.id]);

  const { setNodeRef, isOver } = useDroppable({
    id: `driver-lane-${driver.id}`,
    data: {
      type: "DriverLane",
      driverId: driver.id,
      dutySpan,
    },
  });

  const timelineStart = startOfDay(baseDate).setHours(TIMELINE_START_HOUR, 0, 0, 0);

  return (
    <div 
      className={cn(
        "flex items-center group border-b border-slate-200 dark:border-slate-800 relative transition-all duration-300",
        viewMode === "weekly" ? "min-h-[72px]" : "min-h-[64px]",
        isActive ? "bg-rose-50/30 dark:bg-rose-500/5" : "hover:bg-slate-50/30 dark:hover:bg-slate-800/20"
      )}
    >
      {/* Driver Info Sidebar (Sticky Left) */}
      <div 
        className="w-60 flex-shrink-0 flex items-center justify-between pr-4 pl-8 z-30 sticky left-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800 shadow-[10px_0_15px_-3px_rgba(0,0,0,0.02)] cursor-pointer group/sidebar transition-all duration-300"
        onClick={onRowClick}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-slate-800 shadow-md transition-transform group-hover/sidebar:scale-105">
              <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-600 text-white text-[10px] font-bold">
                {driver.name ? driver.name.substring(0, 2).toUpperCase() : "DR"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate tracking-tight group-hover/sidebar:text-rose-600 transition-colors">{driver.name || "Unknown Driver"}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Available</span>
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-[9px] font-semibold text-slate-400 truncate tracking-tighter uppercase">{driver.licenseNumber || "Standard"}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Duty Span Trigger */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full transition-all",
              dutySpan ? "text-rose-500 bg-rose-50 hover:bg-rose-100" : "text-slate-300 hover:text-rose-500 hover:bg-rose-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              dispatch(openDutySpanModal([driver.id]));
            }}
          >
            <Clock className="h-4 w-4" />
          </Button>

          {/* Selection Dot */}
          <div 
            className={cn(
              "w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer",
              isSelected 
                ? "bg-rose-500 border-rose-500 shadow-sm" 
                : "border-slate-200 bg-white hover:border-rose-300 opacity-0 group-hover/sidebar:opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(driver.id);
            }}
          >
            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
        </div>
      </div>


      {/* Main Content Area */}
      {viewMode === "weekly" ? (
        <div className="flex-1 relative h-[72px]">
          {/* Day dividers in background */}
          {weekDays.map((day, idx) => {
            const dayFormatted = format(day, "yyyy-MM-dd");
            const dayDuty = dutySpanByDate[dayFormatted];

            return (
              <div 
                key={idx}
                className={cn(
                  "absolute top-0 bottom-0 border-l border-slate-200 dark:border-slate-800 transition-colors",
                  dayFormatted === format(new Date(), "yyyy-MM-dd") ? "bg-rose-50/10" : ""
                )}
                style={{ left: `${idx * 24 * 60 * 0.5}px`, width: `${24 * 60 * 0.5}px` }}
              >
                {/* Duty Span for this specific day in Weekly View */}
                {dayDuty && (
                  <DutySpanOverlay
                    startTime={dayDuty.startTime}
                    endTime={dayDuty.endTime}
                    baseDate={day}
                    scale={0.5}
                  />
                )}
              </div>
            );
          })}

          {/* Render actual assignments across the week */}
          {(() => {
            const startOfWeekDate = startOfWeek(baseDate, { weekStartsOn: 1 });
            const weekReferenceMs = startOfWeekDate.getTime();
            const weeklyScale = 0.5;

            const sorted = [...assignments].sort(
              (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
            );

            return sorted.map((assignment, idx) => {
              const startMin = differenceInMinutes(new Date(assignment.scheduledStart), startOfWeekDate);
              const endMin = differenceInMinutes(new Date(assignment.scheduledEnd), startOfWeekDate);

              const leftOffset = Math.max(0, startMin * weeklyScale);
              const width = Math.max(10, (endMin - startMin) * weeklyScale);

              if (startMin < 0 || startMin > 7 * 24 * 60) return null;

              const travel = calcTravelBlock(assignment, sorted, idx, weekReferenceMs, weeklyScale, undefined);

              return (
                <React.Fragment key={assignment.id}>
                  {travel && (
                    <TravelBlock
                      leftPx={travel.leftPx}
                      widthPx={travel.widthPx}
                      estimatedMins={travel.estimatedMins}
                      isConflict={travel.isConflict}
                    />
                  )}
                  <div
                    className="absolute top-3.5 z-20"
                    style={{ left: `${leftOffset}px`, width: `${width}px` }}
                  >
                    <AssignmentBlock
                      id={`assign-${assignment.id}`}
                      assignment={assignment}
                      title={`#${assignment.jobId}`}
                      durationHours={(endMin - startMin) / 60}
                      onClick={() => onAssignmentClick?.(assignment)}
                    />
                  </div>
                </React.Fragment>
              );
            });
          })()}
        </div>
      ) : (
        <div 
          ref={setNodeRef}
          className={`flex-1 relative h-[60px] rounded-md transition-colors ${
            isOver 
              ? dutySpan ? "bg-primary/5 ring-1 ring-primary" : "bg-destructive/5 ring-1 ring-destructive" 
              : "bg-muted/5 group-hover:bg-muted/10"
          }`}
        >
          {/* Duty Span Background Overlay */}
          {dutySpan && (
            <DutySpanOverlay
              startTime={dutySpan.startTime}
              endTime={dutySpan.endTime}
              baseDate={baseDate}
            />
          )}

          {!dutySpan && isOver && (
             <div className="absolute inset-0 flex items-center justify-center text-xs text-destructive font-semibold z-10 pointer-events-none">
               Duty Span Required
             </div>
          )}

          {/* Render actual assignments with travel blocks & break blocks */}
          {(() => {
            const sorted = [...assignments].sort(
              (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
            );

            return sorted.map((assignment, idx) => {
              const startMin = differenceInMinutes(new Date(assignment.scheduledStart), timelineStart);
              const durationMins = assignment.job?.durationHours
                ? Number(assignment.job.durationHours) * 60
                : differenceInMinutes(new Date(assignment.scheduledEnd), new Date(assignment.scheduledStart));
              const endMin = startMin + (durationMins > 0 ? durationMins : 60);

              const leftOffset = Math.max(0, startMin * PIXELS_PER_MINUTE);
              const width = Math.max(20, durationMins * PIXELS_PER_MINUTE);

              const travel = calcTravelBlock(
                assignment,
                sorted,
                idx,
                timelineStart,
                PIXELS_PER_MINUTE,
                dutySpan
              );

              // Calculate break block after this assignment if rest gap (before travel to next assignment) >= 30 mins
              let breakElement: React.ReactNode = null;
              if (idx < sorted.length - 1) {
                const nextAssignment = sorted[idx + 1];
                const nextStartMin = differenceInMinutes(new Date(nextAssignment.scheduledStart), timelineStart);
                const nextTravelMins = (nextAssignment.travelToMinutes && Number(nextAssignment.travelToMinutes) > 0)
                  ? Number(nextAssignment.travelToMinutes)
                  : DEFAULT_TRAVEL_MINS;
                const nextTravelStartMin = nextStartMin - nextTravelMins;
                const restGapMins = nextTravelStartMin - endMin;

                if (restGapMins >= 30) {
                  const breakLeftPx = endMin * PIXELS_PER_MINUTE;
                  const breakWidthPx = Math.min(restGapMins, 45) * PIXELS_PER_MINUTE;
                  breakElement = (
                    <BreakBlock
                      key={`break-${assignment.id}`}
                      leftPx={breakLeftPx}
                      widthPx={breakWidthPx}
                      durationMins={Math.round(restGapMins)}
                    />
                  );
                }
              }

              return (
                <React.Fragment key={assignment.id}>
                  {travel && (
                    <TravelBlock
                      leftPx={travel.leftPx}
                      widthPx={travel.widthPx}
                      estimatedMins={travel.estimatedMins}
                      isConflict={travel.isConflict}
                    />
                  )}
                  {breakElement}
                  <div
                    className="absolute top-2 z-20"
                    style={{ left: `${leftOffset}px`, width: `${width}px` }}
                  >
                    <AssignmentBlock
                      id={`assign-${assignment.id}`}
                      assignment={assignment}
                      title={`Job #${assignment.jobId}`}
                      durationHours={(endMin - startMin) / 60}
                      onClick={() => onAssignmentClick?.(assignment)}
                    />
                  </div>
                </React.Fragment>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
