"use client";

import React, { useState, useEffect } from "react";
import { format, addDays, parseISO, startOfWeek } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  User,
  Clock,
  Car,
  ChevronRight,
  RefreshCcw,
  CalendarCheck2,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreviewAutoScheduleQuery, useRunAutoScheduleMutation } from "@/services/api/dispatch.api";

interface AutoScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The dispatch board date (yyyy-MM-dd) */
  date: string;
}

type ModalPhase = "preview" | "running" | "result";
type PresetOption = "3days" | "2weeks" | "custom";

export function AutoScheduleModal({ isOpen, onClose, date }: AutoScheduleModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("preview");
  const [preset, setPreset] = useState<PresetOption>("3days");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [forceRun, setForceRun] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Derive active date range cleanly without setState inside useEffect
  const { activeStartDate, activeEndDate } = React.useMemo(() => {
    if (!date) return { activeStartDate: "", activeEndDate: "" };
    const base = parseISO(date);
    if (preset === "3days") {
      return {
        activeStartDate: format(base, "yyyy-MM-dd"),
        activeEndDate: format(addDays(base, 2), "yyyy-MM-dd"),
      };
    }
    if (preset === "2weeks") {
      return {
        activeStartDate: format(base, "yyyy-MM-dd"),
        activeEndDate: format(addDays(base, 13), "yyyy-MM-dd"),
      };
    }
    return {
      activeStartDate: customStartDate || date,
      activeEndDate: customEndDate || date,
    };
  }, [date, preset, customStartDate, customEndDate]);

  const {
    data: preview,
    isLoading: previewLoading,
    isError: previewError,
    refetch: refetchPreview,
  } = usePreviewAutoScheduleQuery(
    { startDate: activeStartDate, endDate: activeEndDate },
    { skip: !isOpen || !activeStartDate || !activeEndDate, refetchOnMountOrArgChange: true }
  );

  // Re-fetch preview automatically when date range or modal visibility changes
  useEffect(() => {
    if (isOpen && activeStartDate && activeEndDate) {
      refetchPreview();
    }
  }, [isOpen, activeStartDate, activeEndDate, refetchPreview]);

  const [runAutoSchedule] = useRunAutoScheduleMutation();

  const handleRun = async () => {
    setPhase("running");
    setRunError(null);
    try {
      const result = await runAutoSchedule({
        startDate: activeStartDate,
        endDate: activeEndDate,
        force: forceRun,
      }).unwrap();
      setRunResult(result);
      setPhase("result");
    } catch (err: any) {
      const msg = err?.data?.error || "Auto-schedule failed. Please try again.";
      setRunError(msg);
      setPhase("result");
    }
  };

  const handleClose = () => {
    setPhase("preview");
    setRunResult(null);
    setRunError(null);
    setForceRun(false);
    onClose();
  };

  const proposed = preview?.proposed ?? [];
  const skipped = preview?.skipped ?? [];
  const totalJobs = preview?.totalJobs ?? 0;
  const assignableCount = preview?.assignableCount ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        {/* Header gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-500" />

        <div className="p-6 pb-3">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Zap className="h-5 w-5 text-white fill-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-slate-900">
                    Auto-Schedule Jobs
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400 font-medium">
                    Schedule trips automatically with Punchbowl depot travel buffers & fatigue checks
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Time Period Selector Bar */}
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Select Scheduling Time Period:
              </span>
              <div className="flex bg-slate-200/70 p-1 rounded-lg gap-1">
                <button
                  type="button"
                  onClick={() => setPreset("3days")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all",
                    preset === "3days"
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  3 Days
                </button>
                <button
                  type="button"
                  onClick={() => setPreset("2weeks")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all",
                    preset === "2weeks"
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  2 Weeks
                </button>
                <button
                  type="button"
                  onClick={() => setPreset("custom")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all",
                    preset === "custom"
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Custom Range
                </button>
              </div>
            </div>

            {/* Custom Range Inputs or Active Range Display */}
            {preset === "custom" ? (
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Start Date</label>
                  <Input
                    type="date"
                    value={customStartDate || activeStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-8 text-xs font-semibold bg-white border-slate-200 rounded-lg"
                  />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 mt-4" />
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">End Date</label>
                  <Input
                    type="date"
                    value={customEndDate || activeEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-8 text-xs font-semibold bg-white border-slate-200 rounded-lg"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchPreview()}
                  className="mt-4 h-8 text-xs font-bold gap-1 text-violet-700 border-violet-200 hover:bg-violet-50"
                >
                  <RefreshCcw className="h-3 w-3" /> Update Preview
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <Calendar className="h-3.5 w-3.5 text-violet-600" />
                <span>
                  {activeStartDate && activeEndDate
                    ? `${format(parseISO(activeStartDate), "MMM d, yyyy")} – ${format(parseISO(activeEndDate), "MMM d, yyyy")}`
                    : "Loading..."}
                </span>
                <Badge variant="secondary" className="ml-auto text-[10px] font-black bg-violet-100 text-violet-700">
                  {preset === "3days" ? "3 Days" : "14 Days"}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* ── PREVIEW PHASE ───────────────────────────────────────── */}
        {phase === "preview" && (
          <>
            {previewLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="text-sm font-semibold text-slate-400">Analysing unassigned jobs & driver loads for selected range…</p>
              </div>
            )}

            {previewError && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
                <XCircle className="h-8 w-8 text-rose-400" />
                <p className="text-sm font-semibold text-slate-500 text-center">
                  Could not load preview for selected range. Check backend connection.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetchPreview()} className="gap-2">
                  <RefreshCcw className="h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            )}

            {!previewLoading && !previewError && preview && (
              <>
                {/* Summary Pills */}
                <div className="flex items-center gap-3 px-6 pb-3">
                  <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5">
                    <CalendarCheck2 className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-black text-violet-700">{totalJobs}</span>
                    <span className="text-xs font-semibold text-violet-500">Unassigned Jobs</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-black text-emerald-700">{assignableCount}</span>
                    <span className="text-xs font-semibold text-emerald-500">Will Assign</span>
                  </div>
                  {skipped.length > 0 && (
                    <>
                      <ArrowRight className="h-4 w-4 text-slate-300" />
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-black text-amber-700">{skipped.length}</span>
                        <span className="text-xs font-semibold text-amber-500">Cannot Assign</span>
                      </div>
                    </>
                  )}
                </div>

                {totalJobs === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-2 text-center px-6">
                    <CalendarCheck2 className="h-10 w-10 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">No unassigned jobs found for period ({activeStartDate} to {activeEndDate}).</p>
                    <p className="text-xs text-slate-300">Try switching presets or picking a custom date range containing unassigned trips.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[280px] px-6">
                    {/* Proposed Assignments */}
                    {proposed.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                          Proposed Assignments ({proposed.length})
                        </p>
                        <div className="space-y-2">
                          {proposed.map((item: any) => (
                            <div
                              key={item.jobId}
                              className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div className="flex-shrink-0 w-16 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                <span className="text-[10px] font-black text-indigo-600">
                                  #{item.jobId}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                {item.jobStartLocation && (
                                  <p className="text-[10px] text-slate-400 truncate font-medium">
                                    {item.jobStartLocation?.split(",")[0]}
                                    {item.jobEndLocation ? ` → ${item.jobEndLocation?.split(",")[0]}` : ""}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <div className="flex items-center gap-1 text-slate-600">
                                    <Clock className="h-3 w-3 text-slate-300" />
                                    <span className="text-[11px] font-bold">
                                      {format(new Date(item.scheduledStart), "MMM d, HH:mm")}
                                      {" – "}
                                      {format(new Date(item.scheduledEnd), "HH:mm")}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <ChevronRight className="h-3.5 w-3.5 text-slate-200 flex-shrink-0" />

                              <div className="flex-shrink-0 text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  <User className="h-3 w-3 text-violet-400" />
                                  <span className="text-[11px] font-bold text-slate-700 truncate max-w-[100px]">
                                    {item.driverName}
                                  </span>
                                </div>
                                {item.vehicleName && (
                                  <div className="flex items-center gap-1 justify-end mt-0.5">
                                    <Car className="h-3 w-3 text-slate-300" />
                                    <span className="text-[10px] text-slate-400 font-medium">{item.vehicleName}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skipped Jobs */}
                    {skipped.length > 0 && (
                      <div className="mb-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-2">
                          Cannot Assign ({skipped.length})
                        </p>
                        <div className="space-y-1.5">
                          {skipped.map((item: any) => (
                            <div
                              key={item.jobId}
                              className="flex items-center gap-3 bg-amber-50/60 border border-amber-100 rounded-xl p-3"
                            >
                              <div className="flex-shrink-0 w-16 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center">
                                <span className="text-[10px] font-black text-amber-600">#{item.jobId}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-amber-700 truncate">{item.reason}</p>
                                {item.jobStartLocation && (
                                  <p className="text-[10px] text-amber-400 truncate">{item.jobStartLocation?.split(",")[0]}</p>
                                )}
                              </div>
                              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between gap-4 p-6 pt-4 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      className={cn(
                        "relative w-8 h-4 rounded-full transition-colors cursor-pointer",
                        forceRun ? "bg-violet-500" : "bg-slate-200"
                      )}
                      onClick={() => setForceRun((v) => !v)}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all",
                          forceRun ? "left-[18px]" : "left-0.5"
                        )}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">Force re-run</span>
                  </label>

                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={handleClose} className="rounded-xl text-xs font-bold h-9">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRun}
                      disabled={totalJobs === 0 || assignableCount === 0}
                      className="h-9 px-5 rounded-xl text-xs font-black bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/30 gap-2 disabled:opacity-40"
                    >
                      <Zap className="h-3.5 w-3.5 fill-white" />
                      Schedule {assignableCount} Job{assignableCount !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── RUNNING PHASE ───────────────────────────────────────── */}
        {phase === "running" && (
          <div className="flex flex-col items-center justify-center py-20 gap-5 px-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
                <Zap className="h-8 w-8 text-white fill-white" />
              </div>
              <div className="absolute -inset-2 rounded-2xl border-2 border-violet-500/20 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-slate-800">Scheduling in progress…</p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Checking travel times, fatigue limits, and conflicts for period {activeStartDate} to {activeEndDate}
              </p>
            </div>
          </div>
        )}

        {/* ── RESULT PHASE ────────────────────────────────────────── */}
        {phase === "result" && (
          <div className="flex flex-col items-center justify-center py-12 gap-5 px-6">
            {runError ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-rose-500" />
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-slate-800">Scheduling Failed</p>
                  <p className="text-sm text-slate-500 font-medium mt-1 max-w-sm text-center">
                    {runError}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-xl text-xs font-bold h-9" onClick={() => { setPhase("preview"); setRunError(null); }}>
                    Back to Preview
                  </Button>
                  <Button className="h-9 px-5 rounded-xl text-xs font-black bg-violet-600 hover:bg-violet-700 text-white gap-2" onClick={() => { setForceRun(true); handleRun(); }}>
                    <Zap className="h-3.5 w-3.5 fill-white" /> Force Run
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-slate-800">Schedule Complete!</p>
                  <p className="text-sm text-slate-500 font-medium mt-1">
                    <span className="text-emerald-600 font-black">{runResult?.assignedJobsCount}</span> job
                    {runResult?.assignedJobsCount !== 1 ? "s" : ""} successfully assigned
                    {runResult?.skippedCount > 0 && (
                      <>, <span className="text-amber-600 font-black">{runResult.skippedCount}</span> skipped</>
                    )}
                  </p>
                </div>
                <p className="text-xs text-slate-400 text-center max-w-xs">
                  The timeline has been updated for {activeStartDate} to {activeEndDate}. Duty spans were automatically calculated including depot travel times.
                </p>
                <Button
                  className="h-9 px-6 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  onClick={handleClose}
                >
                  <CalendarCheck2 className="h-3.5 w-3.5" /> View Timeline
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
