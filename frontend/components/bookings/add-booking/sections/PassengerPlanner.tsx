"use client";

import React from "react";
import { Groups, DirectionsBus, Add, Remove } from "@mui/icons-material";
import { cn } from "@/lib/utils";

interface PassengerPlannerProps {
  paxCount: number;
  busCount: number;
  onPaxChange: (count: number) => void;
  onBusChange: (count: number) => void;
  paxError?: string;
  busError?: string;
}

function StepperInput({
  label,
  icon,
  value,
  onChange,
  error,
  min = 1,
  color = "blue",
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  error?: string;
  min?: number;
  color?: "blue" | "emerald";
}) {
  const colorMap = {
    blue: {
      bg: "bg-blue-50",
      text: "text-blue-500",
      activeBg: "bg-blue-500",
      activeText: "text-white",
      ring: "ring-blue-100",
    },
    emerald: {
      bg: "bg-emerald-50",
      text: "text-emerald-500",
      activeBg: "bg-emerald-500",
      activeText: "text-white",
      ring: "ring-emerald-100",
    },
  };
  const c = colorMap[color];

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-center gap-4 p-4 rounded-xl border transition-all",
          error
            ? "border-red-200 bg-red-50/30"
            : "border-slate-100 bg-slate-50/30 hover:border-slate-200"
        )}
      >
        {/* Icon */}
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", c.bg)}>
          <span className={c.text}>{icon}</span>
        </div>

        {/* Label */}
        <div className="flex-1">
          <span className="text-xs font-bold text-slate-700">{label}</span>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {label === "Passengers" ? "Total passengers for this trip" : "Vehicles required"}
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className={cn(
              "w-9 h-9 flex items-center justify-center transition-colors",
              value <= min
                ? "text-slate-200 cursor-not-allowed"
                : "text-slate-500 hover:bg-slate-50 active:bg-slate-100"
            )}
          >
            <Remove style={{ fontSize: "16px" }} />
          </button>
          <input
            type="number"
            min={min}
            value={value}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v)) onChange(Math.max(min, v));
            }}
            className="w-12 text-center text-sm font-bold text-slate-800 tabular-nums border-none focus:ring-0 p-0 h-9 bg-transparent"
          />
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            className={cn(
              "w-9 h-9 flex items-center justify-center transition-colors",
              "text-slate-500 hover:bg-slate-50 active:bg-slate-100"
            )}
          >
            <Add style={{ fontSize: "16px" }} />
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
    </div>
  );
}

export function PassengerPlanner({
  paxCount,
  busCount,
  onPaxChange,
  onBusChange,
  paxError,
  busError,
}: PassengerPlannerProps) {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
          <Groups style={{ fontSize: "14px" }} className="text-blue-500" />
        </div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Transport Planning
        </span>
      </div>

      <StepperInput
        label="Passengers"
        icon={<Groups style={{ fontSize: "20px" }} />}
        value={paxCount}
        onChange={onPaxChange}
        error={paxError}
        color="blue"
      />

      <StepperInput
        label="Vehicles"
        icon={<DirectionsBus style={{ fontSize: "20px" }} />}
        value={busCount}
        onChange={onBusChange}
        error={busError}
        color="emerald"
      />

      {/* Future hint */}
      <p className="text-[10px] text-slate-300 text-center font-medium mt-1">
        Auto-suggest vehicle allocation coming soon
      </p>
    </div>
  );
}
