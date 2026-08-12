"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, X, Clock, ArrowRight, Route } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConflictError {
  /** Full raw message from backend */
  message: string;
  /** Parsed: e.g. 23 */
  fromJobId?: number;
  /** Parsed: e.g. 24 */
  toJobId?: number;
  /** Parsed: required travel minutes */
  requiredMins?: number;
  /** Parsed: available gap minutes */
  availableMins?: number;
  /** Type of conflict */
  type: "travel_time" | "shift_limit" | "fatigue" | "overlap" | "duty_span" | "generic";
}

/**
 * Parses a backend conflict reason string into a structured ConflictError.
 */
export function parseConflictError(rawMessage: string): ConflictError {
  // Travel time: "Insufficient travel time between Job #23 and Job #24. Required: 33 mins, available: 13 mins."
  const travelMatch = rawMessage.match(
    /Insufficient travel time between Job #(\d+) and Job #(\d+)\.\s*Required:\s*(\d+)\s*mins?,\s*available:\s*(\d+)\s*mins?/i
  );
  if (travelMatch) {
    return {
      message: rawMessage,
      fromJobId: Number(travelMatch[1]),
      toJobId: Number(travelMatch[2]),
      requiredMins: Number(travelMatch[3]),
      availableMins: Number(travelMatch[4]),
      type: "travel_time",
    };
  }

  // Shift limit: "...exceed the maximum daily shift duration of 12 hours..."
  if (/exceed the maximum daily shift/i.test(rawMessage)) {
    return { message: rawMessage, type: "shift_limit" };
  }

  // Fatigue: "...exceed the driver's daily fatigue limit..."
  if (/fatigue limit/i.test(rawMessage)) {
    return { message: rawMessage, type: "fatigue" };
  }

  // Overlap: "Driver is already assigned to Job #..."
  const overlapMatch = rawMessage.match(/already assigned to Job #(\d+)/i);
  if (overlapMatch) {
    return { message: rawMessage, toJobId: Number(overlapMatch[1]), type: "overlap" };
  }

  // Duty span
  if (/duty span|outside driver duty/i.test(rawMessage)) {
    return { message: rawMessage, type: "duty_span" };
  }

  return { message: rawMessage, type: "generic" };
}

// ─── Per-type config ──────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  travel_time: {
    title: "Route Conflict",
    accent: "from-rose-600 to-red-600",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200/70 dark:border-rose-800/50",
    iconBg: "bg-rose-100 dark:bg-rose-900/40",
    iconColor: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
  },
  shift_limit: {
    title: "Shift Limit Exceeded",
    accent: "from-orange-500 to-amber-600",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200/70 dark:border-orange-800/50",
    iconBg: "bg-orange-100 dark:bg-orange-900/40",
    iconColor: "text-orange-600 dark:text-orange-400",
    bar: "bg-orange-500",
  },
  fatigue: {
    title: "Fatigue Limit Exceeded",
    accent: "from-amber-500 to-yellow-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200/70 dark:border-amber-800/50",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  overlap: {
    title: "Assignment Overlap",
    accent: "from-violet-600 to-purple-600",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200/70 dark:border-violet-800/50",
    iconBg: "bg-violet-100 dark:bg-violet-900/40",
    iconColor: "text-violet-600 dark:text-violet-400",
    bar: "bg-violet-500",
  },
  duty_span: {
    title: "Outside Duty Span",
    accent: "from-slate-600 to-slate-700",
    bg: "bg-slate-50 dark:bg-slate-900/50",
    border: "border-slate-200/70 dark:border-slate-700/50",
    iconBg: "bg-slate-100 dark:bg-slate-800",
    iconColor: "text-slate-600 dark:text-slate-400",
    bar: "bg-slate-500",
  },
  generic: {
    title: "Assignment Failed",
    accent: "from-rose-600 to-red-600",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200/70 dark:border-rose-800/50",
    iconBg: "bg-rose-100 dark:bg-rose-900/40",
    iconColor: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
  },
};

const AUTO_DISMISS_MS = 8000;

interface ConflictAlertProps {
  conflict: ConflictError;
  onDismiss: () => void;
}

export function ConflictAlert({ conflict, onDismiss }: ConflictAlertProps) {
  const cfg = TYPE_CONFIG[conflict.type];
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-dismiss with progress bar
  useEffect(() => {
    const step = 100 / (AUTO_DISMISS_MS / 50);
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p - step <= 0) {
          clearInterval(intervalRef.current!);
          onDismiss();
          return 0;
        }
        return p - step;
      });
    }, 50);
    return () => clearInterval(intervalRef.current!);
  }, [onDismiss]);

  const isTravelConflict = conflict.type === "travel_time";
  const shortage = isTravelConflict && conflict.requiredMins && conflict.availableMins
    ? conflict.requiredMins - conflict.availableMins
    : null;

  return (
    <div
      className={cn(
        "relative w-full rounded-xl border shadow-lg overflow-hidden",
        "animate-in slide-in-from-top-2 fade-in duration-300",
        cfg.bg,
        cfg.border
      )}
    >
      {/* Top gradient accent bar */}
      <div className={`h-[3px] w-full bg-gradient-to-r ${cfg.accent}`} />

      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Icon */}
        <div className={cn("mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", cfg.iconBg)}>
          <AlertTriangle className={cn("h-4 w-4", cfg.iconColor)} strokeWidth={2.5} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-bold tracking-tight", cfg.iconColor)}>
            {cfg.title}
          </p>

          {/* Travel conflict: rich breakdown */}
          {isTravelConflict && conflict.fromJobId && conflict.toJobId ? (
            <div className="mt-2 space-y-2">
              {/* Job route */}
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-rose-200/60 dark:border-rose-700/40 text-rose-700 dark:text-rose-300 text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm">
                  Job #{conflict.fromJobId}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
                <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-rose-200/60 dark:border-rose-700/40 text-rose-700 dark:text-rose-300 text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm">
                  Job #{conflict.toJobId}
                </span>
              </div>

              {/* Time comparison grid */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-1.5 shadow-sm">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Required</span>
                  <span className="text-base font-black text-rose-600 dark:text-rose-400 leading-tight">
                    {conflict.requiredMins}
                    <span className="text-[10px] font-bold text-rose-400 ml-0.5">min</span>
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="h-px w-6 bg-slate-200 dark:bg-slate-600" />
                  <span className="text-[8px] font-bold text-slate-400 my-0.5">VS</span>
                  <div className="h-px w-6 bg-slate-200 dark:bg-slate-600" />
                </div>

                <div className="flex flex-col items-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-1.5 shadow-sm">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Available</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                    {conflict.availableMins}
                    <span className="text-[10px] font-bold text-emerald-400 ml-0.5">min</span>
                  </span>
                </div>

                {shortage !== null && (
                  <>
                    <div className="flex flex-col items-center">
                      <div className="h-px w-6 bg-slate-200 dark:bg-slate-600" />
                      <span className="text-[8px] font-bold text-slate-400 my-0.5"></span>
                      <div className="h-px w-6 bg-slate-200 dark:bg-slate-600" />
                    </div>
                    <div className="flex flex-col items-center bg-rose-100 dark:bg-rose-900/40 border border-rose-200/60 dark:border-rose-700/40 rounded-lg px-3 py-1.5 shadow-sm">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500">Short by</span>
                      <span className="text-base font-black text-rose-700 dark:text-rose-300 leading-tight">
                        {shortage}
                        <span className="text-[10px] font-bold text-rose-400 ml-0.5">min</span>
                      </span>
                    </div>
                  </>
                )}
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Move Job #{conflict.toJobId} later or reassign to a closer driver.
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {conflict.message}
            </p>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className={cn(
            "flex-shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
            "text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-slate-700"
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="h-[2px] w-full bg-black/5 dark:bg-white/5">
        <div
          className={cn("h-full transition-none", cfg.bar)}
          style={{ width: `${progress}%`, opacity: 0.6 }}
        />
      </div>
    </div>
  );
}
