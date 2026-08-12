"use client";

import React from "react";
import type { RepeatType } from "@/types";
import { WEEKDAY_LABELS, REPEAT_TYPE_OPTIONS } from "../config/booking.config";
import { Input } from "@/components/ui/input";
import { Repeat, CalendarMonth } from "@mui/icons-material";
import { cn } from "@/lib/utils";

interface RepeatBookingSectionProps {
  repeatType?: RepeatType;
  repeatDays: number[];
  repeatStartDate: string;
  repeatEndDate: string;
  onRepeatTypeChange: (type: RepeatType) => void;
  onToggleDay: (day: number) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  errors?: Record<string, string | undefined>;
}

export function RepeatBookingSection({
  repeatType,
  repeatDays,
  repeatStartDate,
  repeatEndDate,
  onRepeatTypeChange,
  onToggleDay,
  onStartDateChange,
  onEndDateChange,
  errors = {},
}: RepeatBookingSectionProps) {
  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
          <Repeat style={{ fontSize: "14px" }} className="text-violet-500" />
        </div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Recurrence Settings
        </span>
      </div>

      {/* Repeat Type Selector */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 ml-1">Repeat Type</label>
        <div className="grid grid-cols-3 gap-2">
          {REPEAT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onRepeatTypeChange(opt.value as RepeatType)}
              className={cn(
                "flex flex-col items-center gap-1 py-3 px-3 rounded-xl border-2 transition-all text-center",
                repeatType === opt.value
                  ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                  : "border-slate-100 bg-slate-50/30 hover:border-slate-200 hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "text-xs font-bold",
                  repeatType === opt.value ? "text-primary" : "text-slate-600"
                )}
              >
                {opt.label}
              </span>
              <span className="text-[10px] text-slate-400">{opt.description}</span>
            </button>
          ))}
        </div>
        {errors.repeatType && (
          <p className="text-xs text-red-500 font-medium ml-1">{errors.repeatType}</p>
        )}
      </div>

      {/* Weekly Day Selector */}
      {repeatType === "weekly" && (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-500 ml-1">
            Select Days
          </label>
          <div className="flex gap-1.5">
            {WEEKDAY_LABELS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => onToggleDay(day.value)}
                className={cn(
                  "w-10 h-10 rounded-xl text-xs font-bold transition-all",
                  repeatDays.includes(day.value)
                    ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                    : "bg-slate-50 text-slate-500 border border-slate-100 hover:border-slate-200 hover:bg-slate-100"
                )}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-500 ml-1 flex items-center gap-1">
            <CalendarMonth style={{ fontSize: "12px" }} />
            Start Date
          </label>
          <Input
            type="date"
            value={repeatStartDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className={cn(
              "h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl",
              errors.repeatStartDate && "border-red-300"
            )}
          />
          {errors.repeatStartDate && (
            <p className="text-xs text-red-500 font-medium ml-1">{errors.repeatStartDate}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-500 ml-1 flex items-center gap-1">
            <CalendarMonth style={{ fontSize: "12px" }} />
            End Date
          </label>
          <Input
            type="date"
            value={repeatEndDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={cn(
              "h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl",
              errors.repeatEndDate && "border-red-300"
            )}
          />
          {errors.repeatEndDate && (
            <p className="text-xs text-red-500 font-medium ml-1">{errors.repeatEndDate}</p>
          )}
        </div>
      </div>
    </div>
  );
}
