"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { CalendarMonth, Schedule, SwapHoriz } from "@mui/icons-material";
import { cn } from "@/lib/utils";

interface DateTimeSectionProps {
  pickupDate: string;
  pickupTime: string;
  onPickupDateChange: (v: string) => void;
  onPickupTimeChange: (v: string) => void;
  pickupDateError?: string;
  pickupTimeError?: string;
  // Round trip
  showReturn?: boolean;
  returnDate?: string;
  returnTime?: string;
  waitingDuration?: number;
  onReturnDateChange?: (v: string) => void;
  onReturnTimeChange?: (v: string) => void;
  onWaitingDurationChange?: (v: number) => void;
  returnDateError?: string;
  returnTimeError?: string;
  // Estimation
  estimatedDuration?: number;
  estimatedDistance?: string;
  calculatedEndTime?: string;
  isEstimating?: boolean;
}

export function DateTimeSection({
  pickupDate,
  pickupTime,
  onPickupDateChange,
  onPickupTimeChange,
  pickupDateError,
  pickupTimeError,
  showReturn = false,
  returnDate,
  returnTime,
  waitingDuration,
  onReturnDateChange,
  onReturnTimeChange,
  onWaitingDurationChange,
  returnDateError,
  returnTimeError,
  estimatedDuration,
  estimatedDistance,
  calculatedEndTime,
  isEstimating,
}: DateTimeSectionProps) {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
          <CalendarMonth style={{ fontSize: "14px" }} className="text-blue-500" />
        </div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {showReturn ? "Pickup & Return Schedule" : "Schedule"}
        </span>
      </div>

      {/* Pickup Date/Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-500 ml-1">Pickup Date <span className="text-red-500">*</span></label>
          <div className="relative">
            <Input
              type="date"
              required
              value={pickupDate}
              onChange={(e) => onPickupDateChange(e.target.value)}
              className={cn(
                "h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl",
                pickupDateError && "border-red-300"
              )}
            />
          </div>
          {pickupDateError && <p className="text-xs text-red-500 font-medium ml-1">{pickupDateError}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-500 ml-1">Pickup Time <span className="text-red-500">*</span></label>
          <div className="relative">
            <Input
              type="time"
              required
              value={pickupTime}
              onChange={(e) => onPickupTimeChange(e.target.value)}
              className={cn(
                "h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl",
                pickupTimeError && "border-red-300"
              )}
            />
          </div>
          {pickupTimeError && <p className="text-xs text-red-500 font-medium ml-1">{pickupTimeError}</p>}
        </div>
      </div>

      {/* Estimation Info */}
      {(estimatedDuration || isEstimating) && (
        <div className={cn(
          "mx-1 p-4 rounded-2xl border shadow-sm space-y-3 transition-all duration-500",
          isEstimating 
            ? "bg-slate-50 border-slate-200 animate-pulse" 
            : "bg-gradient-to-br from-indigo-50/50 to-blue-50/50 border-blue-100/50"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-xl shadow-sm flex items-center justify-center transition-colors",
                isEstimating ? "bg-slate-200" : "bg-white"
              )}>
                {isEstimating ? (
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <Schedule className="text-blue-500" style={{ fontSize: "16px" }} />
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  {isEstimating ? "Calculating Travel..." : "Est. Travel Time"}
                </p>
                {isEstimating ? (
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-sm font-bold text-slate-700">
                    {estimatedDuration} mins <span className="text-slate-400 font-medium">({estimatedDistance})</span>
                  </p>
                )}
              </div>
            </div>
            {!isEstimating && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Calculated Arrival</p>
                <p className="text-sm font-black text-primary">{calculatedEndTime}</p>
              </div>
            )}
          </div>
          
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                isEstimating ? "bg-slate-300 w-1/3 animate-shimmer" : "bg-primary w-full"
              )}
            />
          </div>
        </div>
      )}

      {/* Return Section */}
      {showReturn && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 h-px bg-slate-100" />
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-100">
              <SwapHoriz style={{ fontSize: "14px" }} className="text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                Return Journey
              </span>
            </div>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 ml-1">Return Date <span className="text-red-500">*</span></label>
              <Input
                type="date"
                value={returnDate || ""}
                onChange={(e) => onReturnDateChange?.(e.target.value)}
                className={cn(
                  "h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl",
                  returnDateError && "border-red-300"
                )}
              />
              {returnDateError && <p className="text-xs text-red-500 font-medium ml-1">{returnDateError}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 ml-1">Return Time <span className="text-red-500">*</span></label>
              <Input
                type="time"
                value={returnTime || ""}
                onChange={(e) => onReturnTimeChange?.(e.target.value)}
                className={cn(
                  "h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl",
                  returnTimeError && "border-red-300"
                )}
              />
              {returnTimeError && <p className="text-xs text-red-500 font-medium ml-1">{returnTimeError}</p>}
            </div>
          </div>

          {/* Waiting Duration */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 ml-1">
              Waiting Duration{" "}
              <span className="text-slate-300 font-normal">(optional, in minutes)</span>
            </label>
            <div className="relative">
              <Schedule
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"
                style={{ fontSize: "16px" }}
              />
              <Input
                type="number"
                min="0"
                placeholder="e.g. 30"
                value={waitingDuration ?? ""}
                onChange={(e) => onWaitingDurationChange?.(parseInt(e.target.value) || 0)}
                className="pl-10 h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl w-48"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
