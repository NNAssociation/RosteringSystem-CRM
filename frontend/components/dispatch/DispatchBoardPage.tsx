"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { clipTimelineRange, stackTimelineJobs, timelineWindow } from "@/lib/dispatch-timeline";
import { dateParts, formatTripDate, useWorkflowApi } from "@/lib/workflow-api";
import { useWebSocket } from "@/providers/websocket-provider";
import { useGetBoardDataQuery } from "@/services/api/dispatch.api";
import type { RootState } from "@/store";
import { openDutySpanModal, setSelectedDate, setViewMode } from "@/store/dispatchUI.slice";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Maximize2,
  Minus,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AutoScheduleModal } from "./AutoScheduleModal";
import { jobOf, labelWidth, overlap, times, type DragItem } from "./board/drag-item";
import { DriverLane } from "./board/DriverLane";
import { JobBlock } from "./board/JobBlock";
import { Pool } from "./board/Pool";
import { TimelineGrid } from "./board/TimelineGrid";
import { DutySpanModal } from "./DutySpanModal";
import { useTimelineZoom } from "./useTimelineZoom";

export function DispatchBoardPage() {
  const dispatch = useDispatch(),
    api = useWorkflowApi();
  useEffect(() => {
    const date = new URLSearchParams(window.location.search).get("date");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))) {
      dispatch(setSelectedDate(date));
      dispatch(setViewMode("daily"));
    }
  }, [dispatch]);
  const { selectedDate, viewMode } = useSelector((s: RootState) => s.dispatchUI);
  const {
    currentData: data,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = useGetBoardDataQuery(
    { date: selectedDate, viewMode },
    { pollingInterval: 15000, refetchOnFocus: true, refetchOnReconnect: true },
  );
  const [fullscreen, setFullscreen] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  async function enterFullscreen() {
    setActive(null);
    setDetail(null);
    setAutoOpen(false);
    setFullscreen(true);
    try {
      await board.current?.requestFullscreen?.();
    } catch {
      /* Keep the full-window display when native fullscreen is unavailable. */
    }
  }
  async function exitFullscreen() {
    if (document.fullscreenElement === board.current) await document.exitFullscreen();
    setFullscreen(false);
  }
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === board.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [driverSelection, setDriverSelection] = useState<{ date: string; ids: number[] }>({
    date: selectedDate,
    ids: [],
  });
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const exit = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", exit);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", exit);
    };
  }, [fullscreen]);
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
    useSensor(KeyboardSensor),
  );

  const zone = data?.timeZone || "Australia/Sydney";
  const { start, end } = timelineWindow(
    selectedDate,
    viewMode === "weekly",
    zone,
    data?.windowStart,
    data?.windowEnd,
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

  const scale =
    fullscreen && availableWidth > 0 ? availableWidth / baseTimelineMinutes : baseScale * zoom;
  // Guarantee timeline fills available width: eliminates right-side gap
  const width = Math.max(baseTimelineMinutes * scale, availableWidth);
  const span = (from: string, to: string) => clipTimelineRange(from, to, start, width, scale);

  const jobs = (data?.unassignedJobs || []).filter(
    (j: any) =>
      (!category || j.booking?.bookingType === category) &&
      (!search ||
        `${j.id} ${j.jobStartLocation} ${j.jobEndLocation} ${j.booking?.customer?.name}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );

  const assignments = (data?.assignments || []).filter(
    (a: any) => fullscreen || !category || a.job?.booking?.bookingType === category,
  );

  const drivers = (data?.drivers || []).filter(
    (d: any) =>
      (!(fullscreen || assignedOnly) || assignments.some((a: any) => a.driverId === d.id)) &&
      (fullscreen ||
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
            `${a.jobId} ${a.job?.booking?.customer?.name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )),
  );

  const selectableDrivers = drivers.filter((driver: any) => driver.status === "ACTIVE");
  const selectedDrivers =
    driverSelection.date === selectedDate
      ? driverSelection.ids.filter((id) =>
          selectableDrivers.some((driver: any) => driver.id === id),
        )
      : [];
  function toggleDriver(id: number) {
    setDriverSelection({
      date: selectedDate,
      ids: selectedDrivers.includes(id)
        ? selectedDrivers.filter((selected) => selected !== id)
        : [...selectedDrivers, id],
    });
  }

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
  const nowOffsetPx = ((nowInstant - start) / 60000) * scale;
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
          overlap(from, to, a.scheduledStart, a.scheduledEnd),
      )
    )
      return "Driver has an overlapping assignment";
    const planned = data.dutySpans.filter(
      (s: any) =>
        s.driverId === id &&
        s.source === "MANUAL" &&
        dateParts(s.startTime, zone).date <= dateParts(to, zone).date &&
        dateParts(s.endTime, zone).date >= dateParts(from, zone).date,
    );
    if (
      planned.length &&
      !planned.some(
        (s: any) =>
          Date.parse(s.startTime) <= Date.parse(from) && Date.parse(s.endTime) >= Date.parse(to),
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
            overlap(from, to, a.scheduledStart, a.scheduledEnd),
        ),
    );
  }

  function openDetails(item: DragItem, driver = "") {
    setDetail(item);
    setDriverId(driver || (item.type === "assignment" ? String(item.value.driverId) : ""));
    setVehicleId(
      item.type === "assignment" && item.value.vehicleId ? String(item.value.vehicleId) : "",
    );
  }

  async function assign(item: DragItem, d?: number, v?: number) {
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
          driverId: d ? Number(d) : undefined,
          vehicleId: v ? Number(v) : null,
          scheduledStart,
          scheduledEnd,
        },
      );
      setDetail(null);
      setNotice(
        v
          ? "Driver and vehicle allocated."
          : "Driver rostered. Fleet vehicle pending morning yard allocation.",
      );
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
    openDetails(item, String(target.driverId));
  }

  function moveDate(days: number) {
    const d = new Date(`${selectedDate}T12:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    dispatch(setSelectedDate(d.toISOString().slice(0, 10)));
    setActive(null);
    setDetail(null);
  }

  return (
    <div
      ref={board}
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex h-dvh w-screen flex-col gap-3 overflow-hidden bg-white p-4"
          : "space-y-3.5"
      }
    >
      {fullscreen && (
        <div className="flex shrink-0 items-center justify-between gap-4 px-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Driver Schedule</h1>
            <p className="text-sm text-slate-500">
              {selectedDate}
              {viewMode === "weekly" ? " · Week view" : ""} · {drivers.length} drivers ·{" "}
              {assignments.length} jobs · {zone}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm tabular-nums text-slate-600">
              {dateParts(new Date(nowInstant).toISOString(), zone).time}
            </span>
            <Button variant="outline" size="sm" onClick={exitFullscreen}>
              Exit Fullscreen
            </Button>
          </div>
        </div>
      )}
      {/* Top Controls Toolbar */}
      {!fullscreen && (
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
              onClick={() =>
                dispatch(setSelectedDate(dateParts(new Date().toISOString(), zone).date))
              }
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
            <Button
              variant="outline"
              size="sm"
              aria-pressed={assignedOnly}
              onClick={() => setAssignedOnly(!assignedOnly)}
            >
              Assigned Drivers Only{assignedOnly ? " ✓" : ""}
            </Button>
            <Button variant="outline" size="sm" aria-pressed={fullscreen} onClick={enterFullscreen}>
              <Maximize2 className="mr-1 h-4 w-4" />
              {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </Button>
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
      )}

      {!fullscreen && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="size-4 accent-indigo-600"
              aria-label="Select all visible active drivers"
              disabled={!selectableDrivers.length}
              checked={
                selectableDrivers.length > 0 && selectedDrivers.length === selectableDrivers.length
              }
              onChange={(event) =>
                setDriverSelection({
                  date: selectedDate,
                  ids: event.target.checked
                    ? selectableDrivers.map((driver: any) => driver.id)
                    : [],
                })
              }
            />
            Select drivers
          </label>
          <span className="text-xs text-slate-500">{selectedDrivers.length} selected</span>
          <Button
            size="sm"
            disabled={!selectedDrivers.length || busy}
            onClick={() => dispatch(openDutySpanModal(selectedDrivers))}
          >
            <Clock className="mr-1 h-4 w-4" />
            Add Duty Spans
          </Button>
          {!!selectedDrivers.length && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDriverSelection({ date: selectedDate, ids: [] })}
            >
              Clear selection
            </Button>
          )}
          <span className="text-xs text-slate-500">
            Select driver checkboxes, then set their shifts for {selectedDate}.
          </span>
        </div>
      )}

      {/* Error & Notice Banners */}
      {!fullscreen && error && (
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
      {!fullscreen && notice && (
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
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs"
        >
          <p className="text-sm font-medium text-red-800">
            {(queryError as any)?.data?.error || "Could not load dispatch board."}
          </p>
          <Button variant="outline" size="sm" onClick={refetch} className="mt-4">
            Retry connection
          </Button>
        </div>
      ) : !data ? (
        <div
          role="status"
          className="flex h-72 items-center justify-center rounded-2xl border bg-white p-10"
        >
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
            className={`relative ${fullscreen ? "min-h-0 flex-1" : "max-h-[72vh]"} overflow-auto overscroll-contain rounded-2xl border border-slate-200/90 bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-indigo-500 select-none`}
            aria-label={
              fullscreen
                ? "Driver schedule display"
                : "Dispatch timeline. Mousepad expand or pinch to zoom."
            }
            onKeyDown={(e) => {
              if (fullscreen || e.target !== e.currentTarget) return;
              if (["+", "=", "-", "0"].includes(e.key)) {
                e.preventDefault();
                changeZoom(e.key === "0" ? 1 : e.key === "-" ? zoom / 1.3 : zoom * 1.3);
              }
            }}
          >
            <div
              style={{ width: width + labelWidth }}
              className={fullscreen ? "relative min-h-full" : "relative"}
            >
              {fullscreen && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 top-14"
                  style={{ left: labelWidth, width }}
                >
                  <TimelineGrid scale={scale} showDotted />
                </div>
              )}
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
              {!fullscreen && (
                <Pool
                  height={Math.min(185, Math.max(105, laneCount * 62 + 24))}
                  width={width}
                  count={jobs.length}
                >
                  <TimelineGrid scale={scale} />
                  {stacked.map(({ job, lane }) => (
                    <div
                      key={job.id}
                      className="absolute"
                      style={{
                        ...span(job.jobStartDateTime, job.jobEndDateTime),
                        top: 12 + lane * 62,
                      }}
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
              )}

              {/* Legend Strip - stays fixed in visible viewport when scrolling horizontally */}
              {!fullscreen && (
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
              )}

              {/* Driver Lanes */}
              {drivers.map((driver: any) => {
                const driverJobs = assignments.filter((a: any) => a.driverId === driver.id);
                const reason = active ? driverReason(active, driver.id) : "";
                return (
                  <DriverLane
                    key={driver.id}
                    driver={driver}
                    presentation={fullscreen}
                    selected={selectedDrivers.includes(driver.id)}
                    onSelect={() => toggleDriver(driver.id)}
                    width={width}
                    reason={reason}
                    active={!!active}
                    vehicles={Array.from(
                      new Map(
                        driverJobs
                          .filter((a: any) => a.vehicle)
                          .map((a: any) => [a.vehicle.id, a.vehicle]),
                      ).values(),
                    )}
                    onDuty={() => dispatch(openDutySpanModal([driver.id]))}
                  >
                    {!fullscreen && <TimelineGrid scale={scale} />}
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
                        {!fullscreen && a.travelToMinutes > 0 && (
                          <div
                            title={`Travel: ${a.travelToMinutes} min`}
                            className="absolute top-2.5 z-[2] h-12 rounded-lg border border-cyan-300 bg-cyan-100/85 text-[10px] text-cyan-900 font-medium flex items-center px-1.5 shadow-2xs"
                            style={span(
                              new Date(
                                Date.parse(a.scheduledStart) - a.travelToMinutes * 60000,
                              ).toISOString(),
                              a.scheduledStart,
                            )}
                          >
                            <span className="truncate">🚗 {a.travelToMinutes}m</span>
                          </div>
                        )}
                        <div
                          className="absolute top-2.5 z-10"
                          style={span(a.scheduledStart, a.scheduledEnd)}
                        >
                          <JobBlock
                            item={{ type: "assignment", value: a }}
                            zone={zone}
                            presentation={fullscreen}
                            disabled={
                              fullscreen || busy || ["IN_PROGRESS", "COMPLETED"].includes(a.status)
                            }
                            onClick={() => {
                              if (!fullscreen) openDetails({ type: "assignment", value: a });
                            }}
                          />
                        </div>
                      </React.Fragment>
                    ))}
                  </DriverLane>
                );
              })}
              {!drivers.length && (
                <div className="p-8 text-center text-sm text-slate-400">
                  {fullscreen
                    ? "No assigned driver jobs for this period."
                    : "No drivers match your search query."}
                </div>
              )}
            </div>
          </div>

          {/* Drag Overlay with clean floating shadow card */}
          <DragOverlay>
            {active && (
              <div className="w-68 rounded-xl border border-slate-700 bg-slate-900 p-3.5 text-white shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">Job #{jobOf(active).id}</span>
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
                  Pickup: {jobOf(detail).jobStartLocation}
                  <br />
                  Dropoff: {jobOf(detail).jobEndLocation}
                </p>
                <ol className="mt-2 space-y-1 text-xs text-slate-600">
                  {(jobOf(detail).itinerary || jobOf(detail).booking?.stops || []).map(
                    (stop: any, index: number) => (
                      <li key={index}>
                        {index + 1}. {stop?.kind === "VIA" ? "Via — pass through: " : ""}
                        {typeof stop === "string"
                          ? stop
                          : stop.address || stop.location || stop.name}
                        {typeof stop === "object" && stop.kind !== "VIA" && (
                          <span className="block text-xs text-slate-500">
                            {stop.dwellSeconds ? `${stop.dwellSeconds / 60} min stop. ` : ""}
                            {stop.accessNotes || ""}
                            {stop.entrance
                              ? ` Coach entrance: ${stop.entrance.lat}, ${stop.entrance.lng}`
                              : ""}
                          </span>
                        )}
                      </li>
                    ),
                  )}
                </ol>
                <p className="mt-1 text-xs text-slate-500">
                  {formatTripDate(times(detail)[0], zone)} —{" "}
                  {formatTripDate(times(detail)[1], zone)}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  {jobOf(detail).booking?.passengerCount} passengers ·{" "}
                  {jobOf(detail).booking?.noOfVehicles} vehicles required
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Assign Driver
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
                    value={driverId}
                    onChange={(e) => {
                      setDriverId(e.target.value);
                      setVehicleId("");
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
                    <option value="">Pending Morning Yard Allocation (Recommended)</option>
                    {vehiclesFor(detail).map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.licensePlate} · {v.maxPassengers ?? "Unknown"} seats
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="text-[11px] text-slate-400">
                Advance planning: You can roster the driver now. The Yardman will allocate the
                specific depot bus on departure morning.
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
                    (detail.type === "assignment" &&
                      ["IN_PROGRESS", "COMPLETED"].includes(detail.value.status))
                  }
                  onClick={() =>
                    assign(detail, Number(driverId), vehicleId ? Number(vehicleId) : undefined)
                  }
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {busy
                    ? "Saving…"
                    : detail.type === "job"
                      ? vehicleId
                        ? "Assign Driver & Vehicle"
                        : "Assign Driver (Yard Allocates Bus)"
                      : "Save Assignment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DutySpanModal drivers={data?.drivers || []} />
      <AutoScheduleModal isOpen={autoOpen} onClose={() => setAutoOpen(false)} date={selectedDate} />
    </div>
  );
}
