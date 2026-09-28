"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useGetBoardDataQuery } from "@/services/api/dispatch.api";
import { setSelectedDate, setViewMode, openDutySpanModal } from "@/store/dispatchUI.slice";
import type { RootState } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkflowApi, dateParts, formatTripDate } from "@/lib/workflow-api";
import { AutoScheduleModal } from "./AutoScheduleModal";
import { DutySpanModal } from "./DutySpanModal";
import { useWebSocket } from "@/providers/websocket-provider";
import Link from "next/link";
import { clipTimelineRange, stackTimelineJobs, timelineWindow } from "@/lib/dispatch-timeline";
import { useTimelineZoom } from "./useTimelineZoom";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  X,
  Minus,
  Plus,
  Sparkles,
  Clock,
  Filter,
  Maximize2,
} from "lucide-react";

const labelWidth = 240;
type DragItem = { type: "job" | "assignment"; value: any };

function jobOf(item: DragItem) {
  return item.type === "job" ? item.value : item.value.job;
}
function times(item: DragItem) {
  return item.type === "job"
    ? [item.value.jobStartDateTime, item.value.jobEndDateTime]
    : [item.value.scheduledStart, item.value.scheduledEnd];
}
function overlap(a: string, b: string, c: string, d: string) {
  return Date.parse(a) < Date.parse(d) && Date.parse(b) > Date.parse(c);
}

export function DispatchBoardPage() {
  const dispatch = useDispatch(),
    api = useWorkflowApi();
  useEffect(() => { const date = new URLSearchParams(window.location.search).get("date"); if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))) { dispatch(setSelectedDate(date)); dispatch(setViewMode("daily")); } }, [dispatch]);
  const { selectedDate, viewMode } = useSelector((s: RootState) => s.dispatchUI);
  const {
    currentData: data,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = useGetBoardDataQuery(
    { date: selectedDate, viewMode },
    { pollingInterval: 15000, refetchOnFocus: true, refetchOnReconnect: true }
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const [active, setActive] = useState<DragItem | null>(null);
  const [detail, setDetail] = useState<DragItem | null>(null);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [autoOpen, setAutoOpen] = useState(false);

  // Live real-world clock for the "NOW" vertical indicator
  const [nowInstant, setNowInstant] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowInstant(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const { isConnected } = useWebSocket();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor)
  );

  const zone = data?.timeZone || "Australia/Sydney";
  const { start, end } = timelineWindow(
    selectedDate,
    viewMode === "weekly",
    zone,
    data?.windowStart,
    data?.windowEnd
  );

  // Base scale calculation: daily = 1.5 px/min (90px/hr), weekly = 0.3 px/min (18px/hr)
  const baseScale = viewMode === "weekly" ? 0.3 : 1.5;
  const baseTimelineMinutes = (end - start) / 60000;
  const {
    viewport,
    zoom,
    minimumZoom,
    maximumZoom,
    availableWidth,
    changeZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fit,
    focus15m,
  } = useTimelineZoom(!!data && !isError, labelWidth, baseTimelineMinutes * baseScale);

  const scale = baseScale * zoom;
  // Guarantee timeline fills available width: eliminates right-side gap
  const width = Math.max(baseTimelineMinutes * scale, availableWidth);
  const span = (from: string, to: string) => clipTimelineRange(from, to, start, width, scale);

  const jobs = (data?.unassignedJobs || []).filter(
    (j: any) =>
      (!category || j.booking?.bookingType === category) &&
      (!search ||
        `${j.id} ${j.jobStartLocation} ${j.jobEndLocation} ${j.booking?.customer?.name}`
          .toLowerCase()
          .includes(search.toLowerCase()))
  );

  const assignments = (data?.assignments || []).filter(
    (a: any) => !category || a.job?.booking?.bookingType === category
  );

  const drivers = (data?.drivers || []).filter(
    (d: any) =>
      !search ||
      jobs.length > 0 ||
      `${d.name} ${(data?.vehicles || [])
        .filter((v: any) => v.assignedDriverId === d.id)
        .map((v: any) => v.licensePlate)
        .join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      assignments.some(
        (a: any) =>
          a.driverId === d.id &&
          `${a.jobId} ${a.job?.booking?.customer?.name}`.toLowerCase().includes(search.toLowerCase())
      )
  );

  const stacked = stackTimelineJobs<any>(jobs);
  const laneCount = Math.max(1, ...stacked.map((s) => s.lane + 1));

  // Dynamic header stepping: reduce label density when zoomed out to prevent overlap
  const hourStepOptions = [1, 2, 3, 6, 12, 24];
  const minLabelSpacing = viewMode === "weekly" ? 75 : 60;
  const hourStep = hourStepOptions.find((h) => h * 60 * scale >= minLabelSpacing) ?? 24;
  const headers: number[] = [];
  for (let t = start; t < end; t += hourStep * 3600000) headers.push(t);

  // Sub-hour tick configuration (for 15m and 30m ruler marks)
  const hourPx = 60 * scale;
  const show15mRulerTicks = hourStep === 1 && hourPx >= 75;
  const show15mRulerLabels = hourStep === 1 && hourPx >= 150;

  // Real-time "NOW" indicator position
  const todayStr = dateParts(new Date().toISOString(), zone).date;
  const isSelectedDateToday = selectedDate === todayStr;
  const nowOffsetPx = (nowInstant - start) / 60000 * scale;
  const showNowIndicator = isSelectedDateToday && nowOffsetPx >= 0 && nowOffsetPx <= width;

  function driverReason(item: DragItem, id: number) {
    const d = data.drivers.find((v: any) => v.id === id);
    if (d?.status !== "ACTIVE") return "Driver is not active";
    const [from, to] = times(item);
    if (
      data.assignments.some(
        (a: any) =>
          a.driverId === id &&
          !(item.type === "assignment" && item.value.id === a.id) &&
          overlap(from, to, a.scheduledStart, a.scheduledEnd)
      )
    )
      return "Driver has an overlapping assignment";
    const planned = data.dutySpans.filter(
      (s: any) => s.driverId === id && s.source === "MANUAL" && overlap(from, to, s.startTime, s.endTime)
    );
    if (
      planned.length &&
      !planned.some(
        (s: any) => Date.parse(s.startTime) <= Date.parse(from) && Date.parse(s.endTime) >= Date.parse(to)
      )
    )
      return "Outside planned availability";
    return "";
  }

  function vehiclesFor(item: DragItem) {
    const [from, to] = times(item);
    return (data?.vehicles || []).filter(
      (v: any) =>
        (!v.availableFrom || Date.parse(v.availableFrom) <= Date.parse(from)) &&
        (!v.availableTo || Date.parse(v.availableTo) >= Date.parse(to)) &&
        !data.assignments.some(
          (a: any) =>
            a.vehicleId === v.id &&
            !(item.type === "assignment" && item.value.id === a.id) &&
            overlap(from, to, a.scheduledStart, a.scheduledEnd)
        )
    );
  }

  function openDetails(item: DragItem, driver = "") {
    setDetail(item);
    setDriverId(driver || (item.type === "assignment" ? String(item.value.driverId) : ""));
    const linked = vehiclesFor(item).find((v: any) => v.assignedDriverId === Number(driver));
    setVehicleId(linked ? String(linked.id) : item.type === "assignment" ? String(item.value.vehicleId) : "");
  }

  async function assign(item: DragItem, d: number, v: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const [scheduledStart, scheduledEnd] = times(item);
      await api(
        item.type === "job" ? "dispatch/assignments" : `dispatch/assignments/${item.value.id}`,
        item.type === "job" ? "POST" : "PATCH",
        {
          ...(item.type === "job" ? { jobId: item.value.id } : { version: item.value.version }),
          driverId: d,
          vehicleId: v,
          scheduledStart,
          scheduledEnd,
        }
      );
      setDetail(null);
      setNotice("Assignment saved. Confirmed trip times were preserved.");
      await refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function unassign(item: DragItem) {
    if (item.type !== "assignment" || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`dispatch/assignments/${item.value.id}?version=${item.value.version}`, "DELETE");
      setDetail(null);
      setNotice("Job returned to the unassigned timeline.");
      await refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function drop(event: DragEndEvent) {
    const item = event.active.data.current?.item as DragItem | undefined,
      target = event.over?.data.current;
    setActive(null);
    if (!item || !target || busy) return;
    if (target.pool && item.type === "assignment") {
      await unassign(item);
      return;
    }
    if (!target.driverId) return;
    const reason = driverReason(item, target.driverId);
    if (reason) {
      setError(reason);
      return;
    }
    const linked = vehiclesFor(item).filter((v: any) => v.assignedDriverId === target.driverId);
    if (linked.length === 1) await assign(item, target.driverId, linked[0].id);
    else openDetails(item, String(target.driverId));
  }

  function moveDate(days: number) {
    const d = new Date(`${selectedDate}T12:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    dispatch(setSelectedDate(d.toISOString().slice(0, 10)));
    setActive(null);
    setDetail(null);
  }

  return (
    <div className="space-y-3.5">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs">
        {/* Left: Date navigation & View mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Navigator */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/60 p-0.5 shadow-2xs">
            <Button
              aria-label="Previous date"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:bg-white hover:text-slate-900"
              onClick={() => moveDate(viewMode === "weekly" ? -7 : -1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative flex items-center px-1">
              <Calendar className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                aria-label="Dispatch date"
                type="date"
                className="h-8 w-36 border-0 bg-transparent pl-8 pr-1 text-xs font-semibold text-slate-700 shadow-none focus-visible:ring-0"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    dispatch(setSelectedDate(e.target.value));
                    setDetail(null);
                  }
                }}
              />
            </div>
            <Button
              aria-label="Next date"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:bg-white hover:text-slate-900"
              onClick={() => moveDate(viewMode === "weekly" ? 7 : 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
            onClick={() => dispatch(setSelectedDate(dateParts(new Date().toISOString(), zone).date))}
          >
            Today
          </Button>

          {/* View Mode Segmented Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 shadow-2xs">
            <button
              onClick={() => dispatch(setViewMode("daily"))}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === "daily"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Day
            </button>
            <button
              onClick={() => dispatch(setViewMode("weekly"))}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === "weekly"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Week
            </button>
          </div>

          {/* Trip Category Filter */}
          <div className="relative">
            <select
              aria-label="Trip category"
              className="h-9 appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 focus:border-indigo-500 focus:outline-none"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All trip types</option>
              <option value="one_way">One way</option>
              <option value="round_trip">Round trip</option>
              <option value="repeatable">Recurring</option>
            </select>
            <Filter className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {/* Right: Search, Zoom Controls & Auto Schedule */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative w-48 lg:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              className="h-9 rounded-xl border-slate-200 bg-slate-50/60 pl-8 pr-7 text-xs shadow-2xs focus-visible:bg-white"
              placeholder="Search jobs, drivers…"
              aria-label="Search dispatch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Interactive Zoom Controls & Presets */}
          <div
            className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 shadow-2xs text-xs"
            aria-label="Timeline zoom controls"
          >
            <button
              aria-label="Zoom out"
              title="Zoom out (Pinch in)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30"
              disabled={zoom <= minimumZoom + 0.001}
              onClick={zoomOut}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Reset zoom"
              title="Click to reset to 100%"
              className="flex h-8 w-12 items-center justify-center rounded-lg font-medium tabular-nums text-slate-700 hover:bg-white"
              onClick={resetZoom}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              aria-label="Zoom in"
              title="Zoom in (Pinch out / Expand)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30"
              disabled={zoom >= maximumZoom - 0.001}
              onClick={zoomIn}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-4 w-px bg-slate-200" />

            <button
              onClick={fit}
              title={`Fit ${viewMode === "weekly" ? "week" : "day"} to screen width`}
              className="flex h-8 items-center gap-1 rounded-lg px-2.5 font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
            >
              <Maximize2 className="h-3 w-3" />
              <span>Fit</span>
            </button>

            <button
              onClick={focus15m}
              title="Expand to 15-minute high detail"
              className={`flex h-8 items-center rounded-lg px-2.5 font-semibold transition-all ${
                scale >= 3.0
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              15m Focus
            </button>
          </div>

          <Button
            onClick={() => setAutoOpen(true)}
            size="sm"
            className="h-9 gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
            Auto schedule
          </Button>
        </div>
      </div>


      {/* Error & Notice Banners */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 shadow-xs"
        >
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="rounded p-1 text-red-500 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-xs"
        >
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-emerald-600 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Timeline Viewport */}
      {isError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-red-800">
            {(queryError as any)?.data?.error || "Could not load dispatch board."}
          </p>
          <Button variant="outline" size="sm" onClick={refetch} className="mt-4">
            Retry connection
          </Button>
        </div>
      ) : !data ? (
        <div role="status" className="flex h-72 items-center justify-center rounded-2xl border bg-white p-10">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Loading dispatch timeline…
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={(args) => {
            const hits = pointerWithin(args);
            return hits.length ? hits : rectIntersection(args);
          }}
          onDragStart={(e) => setActive(e.active.data.current?.item)}
          onDragCancel={() => setActive(null)}
          onDragEnd={drop}
        >
          <div
            ref={viewport}
            tabIndex={0}
            className="relative max-h-[72vh] overflow-auto overscroll-contain rounded-2xl border border-slate-200/90 bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-indigo-500 select-none"
            aria-label="Dispatch timeline. Mousepad expand or pinch to zoom."
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (["+", "=", "-", "0"].includes(e.key)) {
                e.preventDefault();
                changeZoom(e.key === "0" ? 1 : e.key === "-" ? zoom / 1.3 : zoom * 1.3);
              }
            }}
          >
            <div style={{ width: width + labelWidth }} className="relative">
              {/* Timeline Header (Hour & 15-Minute Division Ruler) */}
              <div className="sticky top-0 z-40 flex h-14 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs">
                {/* Fixed Resource Column Header */}
                <div
                  style={{ width: labelWidth }}
                  className="sticky left-0 z-50 flex shrink-0 items-center justify-between border-r border-slate-200 bg-slate-50 px-4 py-3 shadow-xs"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Resources / Jobs
                  </span>
                  <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 tabular-nums">
                    {drivers.length} drivers
                  </span>
                </div>

                {/* Time Axis Header */}
                <div className="relative shrink-0" style={{ width }}>
                  {headers.map((t) => {
                    const leftPos = ((t - start) / 60000) * scale;
                    return (
                      <div
                        key={t}
                        style={{ left: leftPos }}
                        className="absolute top-0 h-full border-l-2 border-slate-300 pl-2 pt-2 text-xs font-semibold text-slate-700 whitespace-nowrap"
                      >
                        {viewMode === "weekly" && (
                          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">
                            {new Intl.DateTimeFormat("en-AU", {
                              timeZone: zone,
                              weekday: "short",
                              day: "numeric",
                            }).format(t)}
                          </div>
                        )}
                        <div>
                          {new Intl.DateTimeFormat("en-AU", {
                            timeZone: zone,
                            hour: "2-digit",
                            minute: "2-digit",
                            hourCycle: "h23",
                          }).format(t)}
                        </div>

                        {/* 15m, 30m, 45m sub-tick marks in the ruler when expanded */}
                        {show15mRulerTicks && (
                          <>
                            {/* 15m tick */}
                            <div
                              style={{ left: 15 * scale }}
                              className="absolute bottom-0 h-2 w-px -translate-x-1/2 border-l border-dotted border-slate-400"
                            >
                              {show15mRulerLabels && (
                                <span className="absolute bottom-2.5 -translate-x-1/2 text-[9px] font-normal text-slate-400">
                                  :15
                                </span>
                              )}
                            </div>
                            {/* 30m tick */}
                            <div
                              style={{ left: 30 * scale }}
                              className="absolute bottom-0 h-3 w-px -translate-x-1/2 border-l border-dashed border-slate-500"
                            >
                              <span className="absolute bottom-3 -translate-x-1/2 text-[10px] font-medium text-slate-500">
                                :30
                              </span>
                            </div>
                            {/* 45m tick */}
                            <div
                              style={{ left: 45 * scale }}
                              className="absolute bottom-0 h-2 w-px -translate-x-1/2 border-l border-dotted border-slate-400"
                            >
                              {show15mRulerLabels && (
                                <span className="absolute bottom-2.5 -translate-x-1/2 text-[9px] font-normal text-slate-400">
                                  :45
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time "NOW" Vertical Indicator Line */}
              {showNowIndicator && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-42"
                  style={{ left: labelWidth + nowOffsetPx }}
                >
                  <div className="h-full w-0.5 bg-rose-500 shadow-sm" />
                  <div className="absolute top-1 -translate-x-1/2 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm tracking-wider">
                    NOW
                  </div>
                </div>
              )}

              {/* Unassigned Pool Section */}
              <Pool height={Math.min(185, Math.max(105, laneCount * 62 + 24))} width={width} count={jobs.length}>
                <TimelineGrid scale={scale} />
                {stacked.map(({ job, lane }) => (
                  <div
                    key={job.id}
                    className="absolute"
                    style={{ ...span(job.jobStartDateTime, job.jobEndDateTime), top: 12 + lane * 62 }}
                  >
                    <JobBlock
                      item={{ type: "job", value: job }}
                      zone={zone}
                      disabled={busy}
                      onClick={() => openDetails({ type: "job", value: job })}
                    />
                  </div>
                ))}
                {!jobs.length && (
                  <div className="flex h-full items-center p-6 text-xs text-slate-400">
                    No unassigned confirmed jobs for this date and filter.
                  </div>
                )}
              </Pool>

              {/* Legend Strip - stays fixed in visible viewport when scrolling horizontally */}
              <div
                style={{ width: availableWidth > 0 ? availableWidth + labelWidth : "100%" }}
                className="sticky left-0 z-30 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-y border-slate-200/90 bg-slate-50/95 px-4 py-2 text-xs font-medium text-slate-600 backdrop-blur-xs shadow-2xs"
              >
                <span className="font-bold tracking-wider text-[11px] text-slate-500 uppercase">
                  Driver Schedule
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-4.5 rounded border-2 border-dotted border-amber-500 bg-amber-200/50" />
                  Calculated duty
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-4.5 rounded border-2 border-dashed border-blue-400 bg-blue-100/60" />
                  Planned availability
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-4.5 rounded border border-cyan-300 bg-cyan-100/80" />
                  Travel buffer
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-4.5 rounded border border-indigo-300 bg-indigo-100" />
                  Assigned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-4.5 rounded border border-amber-400 bg-amber-100" />
                  Unassigned
                </span>
                <div className="ml-auto text-[11px] text-slate-400">
                  Grid: <span className="text-slate-600 font-semibold">Solid</span> = 1 hour ·{" "}
                  <span className="text-slate-600 font-semibold">Dashed</span> = 30 min ·{" "}
                  <span className="text-slate-600 font-semibold">Dotted</span> = 15 min
                </div>
              </div>

              {/* Driver Lanes */}
              {drivers.map((driver: any) => {
                const driverJobs = assignments.filter((a: any) => a.driverId === driver.id);
                const reason = active ? driverReason(active, driver.id) : "";
                return (
                  <DriverLane
                    key={driver.id}
                    driver={driver}
                    width={width}
                    reason={reason}
                    active={!!active}
                    vehicles={data.vehicles.filter((v: any) => v.assignedDriverId === driver.id)}
                    onDuty={() => dispatch(openDutySpanModal([driver.id]))}
                  >
                    <TimelineGrid scale={scale} />
                    {data.dutySpans
                      .filter((s: any) => s.driverId === driver.id)
                      .map((s: any) => (
                        <div
                          key={s.id}
                          title={`${
                            s.source === "MANUAL" ? "Planned availability" : "Calculated duty"
                          }: ${formatTripDate(s.startTime, zone)} — ${formatTripDate(s.endTime, zone)}`}
                          className={`absolute top-1 bottom-1 z-[1] rounded-md border-2 ${
                            s.source === "MANUAL"
                              ? "border-dashed border-blue-400 bg-blue-100/60"
                              : "border-dotted border-amber-500 bg-amber-200/50"
                          }`}
                          style={span(s.startTime, s.endTime)}
                        />
                      ))}
                    {driverJobs.map((a: any) => (
                      <React.Fragment key={a.id}>
                        {a.travelToMinutes > 0 && (
                          <div
                            title={`Travel: ${a.travelToMinutes} min`}
                            className="absolute top-2.5 z-[2] h-12 rounded-lg border border-cyan-300 bg-cyan-100/85 text-[10px] text-cyan-900 font-medium flex items-center px-1.5 shadow-2xs"
                            style={span(
                              new Date(Date.parse(a.scheduledStart) - a.travelToMinutes * 60000).toISOString(),
                              a.scheduledStart
                            )}
                          >
                            <span className="truncate">🚗 {a.travelToMinutes}m</span>
                          </div>
                        )}
                        <div className="absolute top-2.5 z-10" style={span(a.scheduledStart, a.scheduledEnd)}>
                          <JobBlock
                            item={{ type: "assignment", value: a }}
                            zone={zone}
                            disabled={busy || ["IN_PROGRESS", "COMPLETED"].includes(a.status)}
                            onClick={() => openDetails({ type: "assignment", value: a })}
                          />
                        </div>
                      </React.Fragment>
                    ))}
                  </DriverLane>
                );
              })}
              {!drivers.length && (
                <div className="p-8 text-center text-sm text-slate-400">
                  No drivers match your search query.
                </div>
              )}
            </div>
          </div>

          {/* Drag Overlay with clean floating shadow card */}
          <DragOverlay>
            {active && (
              <div className="w-68 rounded-xl border border-slate-700 bg-slate-900 p-3.5 text-white shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    Job #{jobOf(active).id}
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                    Fixed Time
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-medium text-slate-100">
                  {jobOf(active).booking?.customer?.name || "Customer trip"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {formatTripDate(times(active)[0], zone)}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Job Details Modal */}
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open && !busy) setDetail(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Job #{detail && jobOf(detail).id}</DialogTitle>
          </DialogHeader>
          {detail && data && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  {jobOf(detail).jobStartLocation} → {jobOf(detail).jobEndLocation}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatTripDate(times(detail)[0], zone)} — {formatTripDate(times(detail)[1], zone)}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  {jobOf(detail).booking?.passengerCount} passengers ·{" "}
                  {jobOf(detail).booking?.noOfVehicles} vehicles required
                </p>
              </div>

              {jobOf(detail).bookingId && (
                <Link
                  className="text-xs font-medium text-indigo-600 underline hover:text-indigo-800"
                  href={`/dashboard/bookings/${jobOf(detail).bookingId}`}
                >
                  Open booking & quotation details →
                </Link>
              )}

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Assign Driver
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
                    value={driverId}
                    onChange={(e) => {
                      setDriverId(e.target.value);
                      const linked = vehiclesFor(detail).find(
                        (v: any) => v.assignedDriverId === Number(e.target.value)
                      );
                      setVehicleId(linked ? String(linked.id) : "");
                    }}
                  >
                    <option value="">Select a driver</option>
                    {data.drivers.map((d: any) => (
                      <option key={d.id} value={d.id} disabled={!!driverReason(detail, d.id)}>
                        {d.name}
                        {driverReason(detail, d.id) ? ` — (${driverReason(detail, d.id)})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Assign Vehicle
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                  >
                    <option value="">Select a vehicle</option>
                    {vehiclesFor(detail).map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.licensePlate} · {v.maxPassengers ?? "Unknown"} seats
                        {v.assignedDriverId === Number(driverId) ? " · (Driver's vehicle)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="text-[11px] text-slate-400">
                Final checks ensure driver rest periods, vehicle capacity, and confirmed trip times.
              </p>

              {error && (
                <p role="alert" className="text-xs font-semibold text-red-600">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                {detail.type === "assignment" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || ["IN_PROGRESS", "COMPLETED"].includes(detail.value.status)}
                    onClick={() => unassign(detail)}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Unassign Job
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={
                    busy ||
                    !driverId ||
                    !vehicleId ||
                    (detail.type === "assignment" &&
                      ["IN_PROGRESS", "COMPLETED"].includes(detail.value.status))
                  }
                  onClick={() => assign(detail, Number(driverId), Number(vehicleId))}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {busy ? "Saving…" : detail.type === "job" ? "Assign Job" : "Save Assignment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DutySpanModal />
      <AutoScheduleModal
        isOpen={autoOpen}
        onClose={() => setAutoOpen(false)}
        date={selectedDate}
      />
    </div>
  );
}

/**
 * Highly differentiated timeline grid:
 * - 60 min (Hour): Strong solid line (slate-400, 1.5px solid)
 * - 30 min (Half-hour): Distinct dashed line (slate-300, 1px dashed 4,4)
 * - 15 min & 45 min (Quarter-hour): Delicate dotted line (slate-300/400, 1px dotted 2,3)
 * Automatically adapts when zoomed out to prevent visual clutter.
 */
function TimelineGrid({ scale }: { scale: number }) {
  const hourWidth = 60 * scale;
  const show15m = hourWidth >= 65;
  const show30m = hourWidth >= 34;
  const patternId = `grid-pattern-${Math.round(scale * 100)}`;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={patternId}
            width={hourWidth}
            height="100%"
            patternUnits="userSpaceOnUse"
          >
            {/* 15m and 45m lines: delicate dotted lines, unmistakably different from solid hour lines */}
            {show15m && (
              <>
                <line
                  x1={15 * scale}
                  y1="0"
                  x2={15 * scale}
                  y2="100%"
                  stroke="#94a3b8"
                  strokeOpacity="0.45"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
                <line
                  x1={45 * scale}
                  y1="0"
                  x2={45 * scale}
                  y2="100%"
                  stroke="#94a3b8"
                  strokeOpacity="0.45"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
              </>
            )}

            {/* 30m half-hour line: medium dashed line */}
            {show30m && (
              <line
                x1={30 * scale}
                y1="0"
                x2={30 * scale}
                y2="100%"
                stroke="#64748b"
                strokeOpacity="0.5"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            )}

            {/* 60m top-of-hour separator: crisp, solid rule */}
            <line
              x1={hourWidth}
              y1="0"
              x2={hourWidth}
              y2="100%"
              stroke="#64748b"
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}

function Pool({
  children,
  height,
  width,
  count,
}: {
  children: React.ReactNode;
  height: number;
  width: number;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "unassigned-pool",
    data: { pool: true },
  });
  return (
    <div
      ref={setNodeRef}
      className={`sticky top-14 z-35 flex border-b border-slate-200 shadow-xs transition-colors ${
        isOver ? "bg-amber-100/70" : "bg-white"
      }`}
      style={{ height }}
    >
      <div
        style={{ width: labelWidth }}
        className="sticky left-0 z-38 shrink-0 border-r border-slate-200 bg-slate-50 p-4 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-slate-800">Unassigned Jobs</p>
          <span className="rounded-full bg-amber-200/90 px-2 py-0.5 text-[10px] font-bold text-amber-900 tabular-nums">
            {count}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Confirmed trips ready to allocate to drivers
        </p>
      </div>
      <div className="relative shrink-0 bg-slate-50/40" style={{ width }}>
        {children}
      </div>
    </div>
  );
}

function DriverLane({
  driver,
  width,
  children,
  active,
  reason,
  vehicles,
  onDuty,
}: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: `driver-${driver.id}`,
    data: { driverId: driver.id },
  });

  // Initials for avatar
  const initials = driver.name
    ? driver.name
        .split(" ")
        .map((p: string) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "DR";

  return (
    <div className="flex h-20 border-b border-slate-200/80 transition-colors">
      <div
        style={{ width: labelWidth }}
        className="sticky left-0 z-30 flex shrink-0 items-center justify-between border-r border-slate-200 bg-white px-3.5 py-2.5 shadow-xs"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-800">{driver.name}</p>
            <p className="truncate text-[10px] font-medium text-slate-400">
              {vehicles.map((v: any) => v.licensePlate).join(", ") || "No vehicle"}
            </p>
          </div>
        </div>
        <button
          className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          onClick={onDuty}
          title="Set availability & duty spans"
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        title={active ? reason || "Drop to assign at the confirmed trip time" : undefined}
        style={{ width }}
        className={`relative shrink-0 transition-colors ${
          isOver
            ? reason
              ? "bg-red-50/80 ring-2 ring-inset ring-red-400"
              : "bg-emerald-50/80 ring-2 ring-inset ring-emerald-400"
            : active && reason
            ? "bg-red-50/25"
            : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function JobBlock({
  item,
  zone,
  disabled,
  onClick,
}: {
  item: DragItem;
  zone: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const job = jobOf(item);
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `${item.type}-${item.value.id}`,
    data: { item },
    disabled,
  });

  const colour =
    item.type === "job"
      ? "bg-amber-100/90 border-amber-300 text-amber-950 hover:bg-amber-100"
      : item.value.status === "COMPLETED"
      ? "bg-slate-100 border-slate-300 text-slate-600"
      : "bg-indigo-50/95 border-indigo-200 text-indigo-950 hover:bg-indigo-100/90";

  const allocated = job.assignments?.length || 0;
  const required = job.booking?.noOfVehicles || 1;

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
        touchAction: "none",
      }}
      title={`Job #${job.id}: ${job.jobStartLocation} → ${job.jobEndLocation}\n${formatTripDate(
        times(item)[0],
        zone
      )} — ${formatTripDate(times(item)[1], zone)}`}
      className={`w-full h-12 overflow-hidden rounded-xl border px-2.5 py-1 text-left shadow-2xs transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-grab active:cursor-grabbing ${colour}`}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-xs font-bold leading-tight">
          #{job.id} {job.booking?.customer?.name || job.jobCategory}
        </p>
        {item.type === "job" && required > 1 && (
          <span className="shrink-0 rounded bg-amber-200/90 px-1 text-[9px] font-bold">
            {allocated}/{required}
          </span>
        )}
      </div>
      <p className="truncate text-[10px] text-slate-500 mt-0.5">
        <span className="font-semibold text-slate-700">
          {dateParts(times(item)[0], zone).time}–{dateParts(times(item)[1], zone).time}
        </span>{" "}
        · {job.jobStartLocation}
      </p>
    </button>
  );
}
