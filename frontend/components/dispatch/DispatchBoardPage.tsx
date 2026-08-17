"use client";

import React, { useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { format, startOfDay, parseISO, isBefore, isAfter, differenceInMinutes, addHours, startOfWeek, addDays } from "date-fns";
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  Search, 
  Filter, 
  X, 
  ChevronRight,
  LayoutList,
  Zap
} from "lucide-react";
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
import toast from "react-hot-toast";

import { RootState } from "@/store";
import { setSelectedDate, setViewMode, setFilter, setBulkDutySpans } from "@/store/dispatchUI.slice";
import { useGetBoardDataQuery, useUpdateAssignmentMutation, useCreateAssignmentMutation, useGetDutySpansQuery } from "@/services/api/dispatch.api";
import { useGetBookingByIdQuery } from "@/services/api/bookings.api";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { DriverTimelineGrid, TIMELINE_START_HOUR, PIXELS_PER_MINUTE } from "./DriverTimelineGrid";
import { UnassignedBookingPanel } from "./UnassignedBookingPanel";
import { AssignmentBlock } from "./assignment-block";
import { DutySpanModal } from "./DutySpanModal";
import { BookingDetailsPanel } from "../bookings/booking-details-panel";
import { JobDetailsModal } from "./JobDetailsModal";
import { ConflictAlert, ConflictError, parseConflictError } from "./ConflictAlert";
import { AutoScheduleModal } from "./AutoScheduleModal";

export function DispatchBoardPage() {
  const dispatch = useDispatch();
  const { selectedDate, viewMode, filters } = useSelector((state: RootState) => state.dispatchUI);
  const { data, isLoading, isError } = useGetBoardDataQuery({ date: selectedDate, viewMode });
  const [updateAssignment] = useUpdateAssignmentMutation();
  const [createAssignment] = useCreateAssignmentMutation();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const { data: fullBooking } = useGetBookingByIdQuery(selectedBookingId!, { skip: !selectedBookingId });
  const [isPoolOpen, setIsPoolOpen] = useState(false);
  const [conflictError, setConflictError] = useState<ConflictError | null>(null);
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const [date, setDate] = React.useState<Date>(new Date());
  
  React.useEffect(() => {
    if (selectedDate) setDate(parseISO(selectedDate));
  }, [selectedDate]);

  React.useEffect(() => {
    if (data?.dutySpans) {
      const formattedSpans = data.dutySpans.map((ds: any) => ({
        driverId: ds.driverId,
        date: format(new Date(ds.startTime), "yyyy-MM-dd"),
        startTime: ds.startTime,
        endTime: ds.endTime,
      }));
      dispatch(setBulkDutySpans(formattedSpans));
    }
  }, [data?.dutySpans, dispatch]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center text-destructive">
        Error loading dispatch data. Please try again.
      </div>
    );
  }

  const baseDate = parseISO(selectedDate);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (overData?.type !== "DriverLane") return;

    const driverId = overData.driverId;
    const dutySpan = overData.dutySpan;

    // If no duty span exists, the backend will automatically calculate travel time and create it.

    let newStartTime: Date;
    let durationHours: number;

    const normalizeTimeToBaseDate = (originalTime: Date) => {
      const d = new Date(baseDate);
      d.setHours(originalTime.getHours(), originalTime.getMinutes(), originalTime.getSeconds(), 0);
      return d;
    };

    const getDurationHours = (item: any) => {
      if (item.durationHours) return Number(item.durationHours.toString());
      if (item.jobStartDateTime && item.jobEndDateTime) {
        const start = new Date(item.jobStartDateTime);
        const end = new Date(item.jobEndDateTime);
        const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (diff > 0) return Number(diff.toFixed(1));
      }
      return 2;
    };

    if (activeData?.type === "UnassignedJob") {
      const job = activeData.job;
      if (job.jobStartDateTime) {
        newStartTime = normalizeTimeToBaseDate(new Date(job.jobStartDateTime));
      } else {
        const laneRect = over.rect;
        const dropOffset = event.active.rect.current.translated.left - laneRect.left;
        const safeOffset = Math.max(0, dropOffset);
        const minutesFromStart = Math.round(safeOffset / PIXELS_PER_MINUTE);
        newStartTime = new Date(startOfDay(baseDate));
        newStartTime.setHours(TIMELINE_START_HOUR, minutesFromStart, 0, 0);
      }
      durationHours = getDurationHours(job);
    } else if (activeData?.type === "Assignment") {
      const assignment = activeData.assignment;
      const laneRect = over.rect;
      const dropOffset = event.active.rect.current.translated.left - laneRect.left;
      const safeOffset = Math.max(0, dropOffset);
      const minutesFromStart = Math.round(safeOffset / PIXELS_PER_MINUTE);
      newStartTime = new Date(startOfDay(baseDate));
      newStartTime.setHours(TIMELINE_START_HOUR, minutesFromStart, 0, 0);
      
      const origStart = new Date(assignment.scheduledStart);
      const origEnd = assignment.scheduledEnd ? new Date(assignment.scheduledEnd) : new Date(origStart.getTime() + 2 * 3600000);
      durationHours = (origEnd.getTime() - origStart.getTime()) / (60 * 60 * 1000);
    } else {
      return;
    }

    const newEndTime = new Date(newStartTime.getTime() + durationHours * 60 * 60 * 1000);
    
    // Normalize dates for comparison to handle ISO date mismatches
    const normalizeToSelectedDate = (timeStr: string) => {
      const t = new Date(timeStr);
      const d = new Date(baseDate);
      d.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), 0);
      return d;
    };

    if (dutySpan) {
      const dutyStart = normalizeToSelectedDate(dutySpan.startTime);
      const dutyEnd = normalizeToSelectedDate(dutySpan.endTime);

      if (isBefore(newStartTime, dutyStart) || isAfter(newEndTime, dutyEnd)) {
        setConflictError(parseConflictError(
          `Job time (${format(newStartTime, "HH:mm")}) is outside driver duty span (${format(dutyStart, "HH:mm")} - ${format(dutyEnd, "HH:mm")})`
        ));
        return;
      }
    }

    try {
      if (activeData?.type === "UnassignedJob") {
        const job = activeData.job;
        await createAssignment({
          jobId: job.id,
          driverId,
          vehicleId: data?.vehicles?.[0]?.id,
          scheduledStart: newStartTime.toISOString(),
          scheduledEnd: newEndTime.toISOString(),
        }).unwrap();
        toast.success(`Assigned Job #${job.id} to Driver #${driverId}`);
      } else if (activeData?.type === "Assignment") {
        const assignment = activeData.assignment;
        await updateAssignment({
          id: assignment.id,
          data: {
            driverId,
            scheduledStart: newStartTime.toISOString(),
            scheduledEnd: newEndTime.toISOString(),
            version: assignment.version,
          }
        }).unwrap();
        toast.success("Assignment updated");
      }
    } catch (error: any) {
      const msg = error.data?.error || error.message || "Failed to assign job";
      setConflictError(parseConflictError(msg));
    }
  };

  const activeItem = (() => {
    if (!activeId || !data) return null;
    if (String(activeId).startsWith("job-")) {
      const jobId = Number(String(activeId).replace("job-", ""));
      return data.unassignedJobs?.find((j: any) => j.id === jobId);
    }
    if (String(activeId).startsWith("assign-")) {
      const assignId = Number(String(activeId).replace("assign-", ""));
      return data.assignments?.find((a: any) => a.id === assignId);
    }
    return null;
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToWindowEdges]}
    >
      <div className="flex h-[calc(100vh-10rem)] w-full gap-4 overflow-hidden">
        {/* Left Side: Timeline & Toolbar */}
        <div className="flex flex-col flex-1 min-w-0 gap-4 overflow-hidden">
          {/* Simplified Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                  variant="outline"
                  className="h-10 px-4 border-slate-200 bg-white rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-rose-500" />
                  {viewMode === "weekly" 
                    ? `${format(startOfWeek(date, { weekStartsOn: 1 }), "MMM dd")} - ${format(addDays(startOfWeek(date, { weekStartsOn: 1 }), 6), "MMM dd, yyyy")}`
                    : format(date, "MMMM dd, yyyy")
                  }
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border shadow-xl rounded-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      if (d) dispatch(setSelectedDate(format(d, "yyyy-MM-dd")));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-4 text-xs font-bold rounded-md transition-all",
                  viewMode === "daily" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500"
                )}
                onClick={() => dispatch(setViewMode("daily"))}
              >
                Daily
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-4 text-xs font-bold rounded-md transition-all",
                  viewMode === "weekly" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500"
                )}
                onClick={() => dispatch(setViewMode("weekly"))}
              >
                Weekly
              </Button>
              </div>

              <Select 
                value={filters.bookingType} 
                onValueChange={(val) => dispatch(setFilter({ key: 'bookingType', value: val === "all" ? "" : val }))}
              >
                <SelectTrigger className="w-[160px] h-10 rounded-lg border-slate-200 bg-white font-semibold text-xs text-slate-600">
                  <Filter className="mr-2 h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="border shadow-xl rounded-lg">
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="one_way">One Way</SelectItem>
                  <SelectItem value="round_trip">Round Trip</SelectItem>
                  <SelectItem value="repeatable">Repeatable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-72 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                <Input 
                  placeholder="Search fleet or driver..." 
                  value={filters.driver}
                  onChange={(e) => dispatch(setFilter({ key: 'driver', value: e.target.value }))}
                  className="pl-10 h-10 border-slate-200 bg-white rounded-lg text-sm focus-visible:ring-rose-500/20 shadow-sm"
                />
              </div>

              {/* Auto-Schedule Button */}
              <Button
                onClick={() => setIsAutoScheduleOpen(true)}
                className="h-10 px-4 rounded-xl text-xs font-black gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-violet-500/20 flex-shrink-0"
              >
                <Zap className="h-4 w-4 fill-white" />
                Auto Schedule
              </Button>
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-4 px-1 py-0.5 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Legend</span>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-3 rounded-sm bg-amber-400/30 border border-dashed border-amber-500/50" />
              <span className="text-[10px] font-semibold text-slate-400">Duty Span</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-3 rounded-sm bg-sky-400/30 border border-dashed border-sky-400/60" />
              <span className="text-[10px] font-semibold text-slate-400">Transit</span>
            </div>
            <div className="w-px h-3 bg-slate-100" />
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-rose-500/20 border border-rose-400/40" />
              <span className="text-[10px] font-semibold text-slate-400">One Way</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-violet-500/20 border border-violet-400/40" />
              <span className="text-[10px] font-semibold text-slate-400">Round Trip</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-400/40" />
              <span className="text-[10px] font-semibold text-slate-400">Repeatable</span>
            </div>
          </div>

          {/* Conflict Alert — shown when an assignment action fails */}
          {conflictError && (
            <ConflictAlert
              conflict={conflictError}
              onDismiss={() => setConflictError(null)}
            />
          )}

          {/* Timeline Viewport Container */}
          <div className="flex-1 bg-white border rounded-xl shadow-sm overflow-hidden relative">
            <DriverTimelineGrid 
              onDriverClick={(id) => setSelectedDriverId(prev => prev === id ? null : id)} 
              onAssignmentClick={(a) => setSelectedAssignment(a)}
              activeDriverId={selectedDriverId}
              viewMode={viewMode}
            />
          </div>
        </div>

        {/* Right Side: Unassigned Pool Sidebar (Appears when driver selected) */}
        {selectedDriverId && (
          <div className="w-85 flex-shrink-0 flex flex-col bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-right duration-500 ease-out">
            <div className="p-5 border-b bg-slate-50/50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 tracking-tight">Assign Job</h3>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider mt-0.5">
                  {data?.drivers?.find((d: any) => d.id === selectedDriverId)?.name}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-slate-100 transition-colors"
                onClick={() => setSelectedDriverId(null)}
              >
                <X className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
            
            <div className="flex-1 min-h-0 overflow-hidden">
              <UnassignedBookingPanel 
                jobs={data?.unassignedJobs || []} 
                driverLocation={(() => {
                  if (!selectedDriverId || !data?.assignments) return null;
                  const driverAssignments = data.assignments.filter((a: any) => a.driverId === selectedDriverId);
                  if (driverAssignments.length === 0) return null;
                  
                  // Sort by end time, then start time as fallback
                  const sorted = [...driverAssignments].sort((a, b) => {
                    const timeA = new Date(a.scheduledEnd || a.scheduledStart).getTime();
                    const timeB = new Date(b.scheduledEnd || b.scheduledStart).getTime();
                    return timeB - timeA;
                  });

                  const latest = sorted[0];
                  
                  // Check job coordinates, with booking coordinates as fallback
                  const lat = latest?.job?.jobEndLat ?? latest?.job?.booking?.dropoffLat ?? latest?.job?.jobStartLat ?? latest?.job?.booking?.pickupLat;
                  const lng = latest?.job?.jobEndLng ?? latest?.job?.booking?.dropoffLng ?? latest?.job?.jobStartLng ?? latest?.job?.booking?.pickupLng;

                  if (lat && lng) {
                    return { lat: Number(lat), lng: Number(lng) };
                  }
                  return null;
                })()}
              />
            </div>
          </div>
        )}

        <DutySpanModal />

        <DragOverlay
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }),
          }}
        >
          {activeId && activeItem ? (
            String(activeId).startsWith("job-") ? (
              <AssignmentBlock title={`Job #${activeItem.id}`} durationHours={activeItem.durationHours || 2} isDragging />
            ) : (
              <AssignmentBlock 
                title={`Job #${activeItem.jobId}`} 
                durationHours={differenceInMinutes(new Date(activeItem.scheduledEnd), new Date(activeItem.scheduledStart)) / 60} 
                isDragging 
              />
            )
          ) : null}
        </DragOverlay>
        
        <DutySpanModal />
        
        <JobDetailsModal 
          isOpen={!!selectedAssignment} 
          onClose={() => setSelectedAssignment(null)} 
          assignment={selectedAssignment}
          onViewFullDetails={() => {
            setSelectedBookingId(selectedAssignment?.job?.bookingId || selectedAssignment?.jobId);
            setSelectedAssignment(null);
          }}
        />

        <BookingDetailsPanel 
          booking={fullBooking || null} 
          onClose={() => setSelectedBookingId(null)} 
        />

        <AutoScheduleModal
          isOpen={isAutoScheduleOpen}
          onClose={() => setIsAutoScheduleOpen(false)}
          date={selectedDate}
        />
      </div>
    </DndContext>
  );
}
