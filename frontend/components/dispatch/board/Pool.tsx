"use client";
import { useDroppable } from "@dnd-kit/core";
import React from "react";
import { labelWidth } from "./drag-item";
export function Pool({
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
