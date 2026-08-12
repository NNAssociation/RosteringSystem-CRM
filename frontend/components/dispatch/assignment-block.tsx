"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MapPin, RefreshCcw, ArrowRight } from "lucide-react";

interface AssignmentBlockProps {
  id?: string;
  assignment?: any;
  job?: any;
  title: string;
  durationHours: number;
  isDragging?: boolean;
  onClick?: () => void;
}

// ─── Booking-type palette ────────────────────────────────────────────────────
// Each entry: { bg, border, text, dot, gradient }
const BOOKING_TYPE_STYLE: Record<
  string,
  { bg: string; border: string; text: string; dot: string; gradient: string; icon: React.ReactNode }
> = {
  one_way: {
    bg: "bg-sky-100/90 dark:bg-sky-950/60",
    border: "border-sky-400/80 dark:border-sky-600/70",
    text: "text-sky-950 dark:text-sky-100 font-bold",
    dot: "bg-sky-600",
    gradient: "from-sky-500 to-blue-600",
    icon: <ArrowRight className="h-3 w-3 flex-shrink-0 text-sky-700 dark:text-sky-300" strokeWidth={3} />,
  },
  round_trip: {
    bg: "bg-purple-100/90 dark:bg-purple-950/60",
    border: "border-purple-400/80 dark:border-purple-600/70",
    text: "text-purple-950 dark:text-purple-100 font-bold",
    dot: "bg-purple-600",
    gradient: "from-purple-600 to-indigo-600",
    icon: <RefreshCcw className="h-3 w-3 flex-shrink-0 text-purple-700 dark:text-purple-300" strokeWidth={3} />,
  },
  repeatable: {
    bg: "bg-emerald-100/90 dark:bg-emerald-950/60",
    border: "border-emerald-400/80 dark:border-emerald-600/70",
    text: "text-emerald-950 dark:text-emerald-100 font-bold",
    dot: "bg-emerald-600",
    gradient: "from-emerald-600 to-teal-600",
    icon: <RefreshCcw className="h-3 w-3 flex-shrink-0 text-emerald-700 dark:text-emerald-300" strokeWidth={3} />,
  },
  _default: {
    bg: "bg-sky-100/90 dark:bg-sky-950/60",
    border: "border-sky-400/80 dark:border-sky-600/70",
    text: "text-sky-950 dark:text-sky-100 font-bold",
    dot: "bg-sky-600",
    gradient: "from-sky-500 to-blue-600",
    icon: <ArrowRight className="h-3 w-3 flex-shrink-0 text-sky-700 dark:text-sky-300" strokeWidth={3} />,
  },
};

// Status modifiers (ring color on hover, label badge)
const STATUS_RING: Record<string, string> = {
  CONFIRMED: "hover:ring-emerald-400/50",
  IN_PROGRESS: "hover:ring-amber-400/50",
  COMPLETED: "hover:ring-blue-400/40",
};

function getStyle(assignment?: any, job?: any) {
  if (job) {
    // Unassigned job draggable card — use booking type
    const type = (job.bookingType || job.booking?.bookingType || "one_way").toLowerCase();
    return BOOKING_TYPE_STYLE[type] ?? BOOKING_TYPE_STYLE._default;
  }
  // Assigned block — use booking type from nested job, fall back to status
  const type = (
    assignment?.job?.bookingType ||
    assignment?.job?.booking?.bookingType ||
    ""
  ).toLowerCase();
  return BOOKING_TYPE_STYLE[type] ?? BOOKING_TYPE_STYLE._default;
}

export function AssignmentBlock({
  id,
  assignment,
  job,
  title,
  durationHours,
  isDragging,
  onClick,
}: AssignmentBlockProps) {
  const draggableId = id || (job ? `job-${job.id}` : `assign-${assignment?.id}`);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDndDragging,
  } = useDraggable({
    id: draggableId,
    data: {
      type: job ? "UnassignedJob" : "Assignment",
      assignment,
      job,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging || isDndDragging ? 0.45 : 1,
  };

  const palette = getStyle(assignment, job);
  const statusRing = assignment?.status ? (STATUS_RING[assignment.status] ?? "hover:ring-rose-400/40") : "hover:ring-rose-400/40";

  const subtitle = job
    ? job.jobStartLocation?.split(",")[0] || "Unknown"
    : assignment?.notes || assignment?.job?.jobStartLocation?.split(",")[0] || "Scheduled";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (isDndDragging) return;
        onClick?.();
      }}
      className={`
        relative flex items-center h-[42px] w-full rounded-lg
        border shadow-sm cursor-grab active:cursor-grabbing
        transition-all duration-150
        hover:ring-2 hover:shadow-md
        ${palette.bg} ${palette.border} ${statusRing}
        ${isDndDragging ? "z-50 scale-[1.02] shadow-xl" : "z-10"}
        overflow-hidden group
      `}
    >
      {/* Left accent gradient bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${palette.gradient} flex-shrink-0`} />

      {/* Content */}
      <div className="flex flex-col pl-3 pr-2 w-full min-w-0 pointer-events-none">
        {/* Title row */}
        <div className={`flex items-center gap-1 text-[11px] font-bold truncate ${palette.text}`}>
          {palette.icon}
          <span className="truncate">{title}</span>
        </div>

        {/* Subtitle row */}
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" strokeWidth={2} />
          <span className="text-[9px] font-semibold text-slate-400 truncate uppercase tracking-tight">
            {subtitle}
          </span>
        </div>
      </div>

      {/* Status dot — top right */}
      {assignment?.status && (
        <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${palette.dot}`} />
      )}
    </div>
  );
}
