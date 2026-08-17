"use client";

import React, { useState, useMemo } from "react";
import { format, addHours, startOfDay, differenceInMinutes, parseISO, isBefore, isAfter, startOfWeek, addDays } from "date-fns";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";

import { useGetBoardDataQuery, useUpdateAssignmentMutation, useCreateAssignmentMutation } from "@/services/api/dispatch.api";
import { DriverRowTimeline } from "./DriverRowTimeline";
import { AssignmentBlock } from "./assignment-block";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Clock, LayoutPanelLeft } from "lucide-react";
import { useDispatch } from "react-redux";
import { openDutySpanModal } from "@/store/dispatchUI.slice";
import { cn } from "@/lib/utils";

export const TIMELINE_START_HOUR = 6;
export const TIMELINE_END_HOUR = 22;
export const PIXELS_PER_MINUTE = 2;

interface DriverTimelineGridProps {
  onDriverClick?: (id: number) => void;
  onAssignmentClick?: (assignment: any) => void;
  activeDriverId?: number | null;
  viewMode?: string;
}

export function DriverTimelineGrid({ onDriverClick, onAssignmentClick, activeDriverId, viewMode }: DriverTimelineGridProps) {
  const { selectedDate, filters } = useSelector((state: RootState) => state.dispatchUI);
  const { data, isLoading } = useGetBoardDataQuery({ date: selectedDate, viewMode });

  const [selectedDriverIds, setSelectedDriverIds] = React.useState<number[]>([]);
  const dispatch = useDispatch();

  const baseDate = parseISO(selectedDate);
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hours = useMemo(() => {
    const arr = [];
    const base = startOfDay(baseDate);
    for (let i = TIMELINE_START_HOUR; i <= TIMELINE_END_HOUR; i++) {
      arr.push(addHours(base, i));
    }
    return arr;
  }, [baseDate]);

  const toggleDriverSelection = (driverId: number) => {
    setSelectedDriverIds(prev =>
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  const handleBulkSetDutySpan = () => {
    if (selectedDriverIds.length > 0) {
      dispatch(openDutySpanModal(selectedDriverIds));
      setSelectedDriverIds([]);
    }
  };

  const weeklyDays = useMemo(() => {
    if (viewMode !== "weekly") return [];
    const start = startOfWeek(baseDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [baseDate, viewMode]);

  const weeklyPixelsPerMinute = 0.5;
  const timelineWidth = viewMode === "weekly" 
    ? 7 * 24 * 60 * weeklyPixelsPerMinute // 7 days * 24h * 60m * 0.5px/m = 5040px
    : (TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1) * 60 * PIXELS_PER_MINUTE;

  const totalMinutes = (TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1) * 60;

  // Generate 15-min grid lines
  const gridLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= totalMinutes; i += 15) {
      lines.push(i);
    }
    return lines;
  }, [totalMinutes]);

  if (isLoading) return null;

  const filteredDrivers = data?.drivers?.filter((d: any) =>
    !filters.driver || d.name?.toLowerCase().includes(filters.driver.toLowerCase())
  ) || [];

  return (
    <div className="h-full overflow-x-auto overflow-y-auto w-full relative scrollbar-none">
      <div style={{ width: `${timelineWidth + 240}px` }} className="min-h-full flex flex-col">
        {/* Timeline Header (Hours) */}
        <div className="flex sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-40 py-6 border-b border-slate-100 dark:border-slate-800 items-center">
          <div className="w-60 flex-shrink-0 flex items-center justify-between pr-4 pl-8 sticky left-0 bg-white dark:bg-slate-900 z-50 border-r border-slate-100 dark:border-slate-800 shadow-[10px_0_15px_-3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <LayoutPanelLeft className="h-4 w-4 text-rose-500" />
              </div>
              <div>
                <span className="block font-bold text-[10px] text-slate-400 uppercase tracking-[0.2em]">Operations</span>
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">Fleet Status</span>
              </div>
            </div>
            {selectedDriverIds.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-full animate-in zoom-in-50 duration-300"
                onClick={handleBulkSetDutySpan}
                title={`Set Duty for ${selectedDriverIds.length} drivers`}
              >
                <Clock className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="flex-1 flex relative h-10">
            {viewMode === "weekly" ? (
              weeklyDays.map((day, idx) => (
                <div
                  key={day.toISOString()}
                  className="absolute flex flex-col items-center h-full group border-r border-slate-50 dark:border-slate-800/50"
                  style={{ left: `${idx * 24 * 60 * weeklyPixelsPerMinute}px`, width: `${24 * 60 * weeklyPixelsPerMinute}px` }}
                >
                  <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-600 mb-2" />
                  <div className="flex flex-col items-center">
                    <span className={cn(
                      "text-[10px] font-black tracking-widest uppercase transition-colors",
                      format(day, "yyyy-MM-dd") === format(currentTime || new Date(), "yyyy-MM-dd") ? "text-rose-600" : "text-slate-500"
                    )}>
                      {format(day, "EEEE")}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{format(day, "MMM dd")}</span>
                  </div>
                </div>
              ))
            ) : (
              hours.map((hour) => (
                <div
                  key={hour.toISOString()}
                  className="absolute flex flex-col items-start h-full"
                  style={{
                    left: `${differenceInMinutes(hour, startOfDay(baseDate).setHours(TIMELINE_START_HOUR)) * PIXELS_PER_MINUTE}px`,
                  }}
                >
                  <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700 mb-2" />
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-tight">
                    {format(hour, "HH:mm")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timeline Body with Grid Background */}
        <div className="flex-1 relative">
          {/* Background Grid Lines */}
          <div className="absolute inset-0 pointer-events-none" style={{ left: '240px', width: `${timelineWidth}px` }}>
            {viewMode === "weekly" ? (
              weeklyDays.map((_, idx) => (
                <div 
                  key={idx}
                  className="absolute top-0 bottom-0 border-l border-slate-300 dark:border-slate-700 transition-all duration-300"
                  style={{ left: `${idx * 24 * 60 * weeklyPixelsPerMinute}px` }}
                />
              ))
            ) : (
              <>
                {gridLines.map((min) => (
                  <div 
                    key={min}
                    className={cn(
                      "absolute top-0 bottom-0 border-l transition-all duration-300",
                      min % 60 === 0 
                        ? "border-slate-400 w-[1px] z-10 opacity-40" 
                        : "border-slate-200 border-dotted opacity-60"
                    )}
                    style={{ left: `${min * PIXELS_PER_MINUTE}px` }}
                  />
                ))}
                {/* Current Time Indicator */}
                {currentTime && format(currentTime, "yyyy-MM-dd") === format(baseDate, "yyyy-MM-dd") && (
                  <div 
                    className="absolute top-0 bottom-0 w-px bg-rose-500 z-30 shadow-[0_0_10px_rgba(244,63,94,0.6)]"
                    style={{ 
                      left: `${differenceInMinutes(currentTime, startOfDay(baseDate).setHours(TIMELINE_START_HOUR)) * PIXELS_PER_MINUTE}px` 
                    }}
                  >
                    <div className="absolute top-0 -left-1.5 w-3 h-3 rounded-full bg-rose-500 shadow-md ring-4 ring-rose-500/10" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Driver Lanes */}
          <div className="space-y-0 relative border-b border-slate-200 dark:border-slate-800">
            {filteredDrivers.map((driver: any) => (
              <DriverRowTimeline
                key={driver.id}
                driver={driver}
                assignments={data?.assignments?.filter((a: any) => a.driverId === driver.id) || []}
                baseDate={baseDate}
                isSelected={selectedDriverIds.includes(driver.id)}
                onToggleSelect={toggleDriverSelection}
                isActive={activeDriverId === driver.id}
                onRowClick={() => onDriverClick?.(driver.id)}
                onAssignmentClick={onAssignmentClick}
                viewMode={viewMode}
              />
            ))}
            {filteredDrivers.length === 0 && (
              <div className="text-center p-12 text-slate-400 font-medium">No drivers matched your search.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
