"use client";
import { useDroppable } from "@dnd-kit/core";
import { Clock } from "lucide-react";
import { labelWidth } from "./drag-item";
export function DriverLane({
  driver,
  width,
  children,
  active,
  reason,
  vehicles,
  onDuty,
  presentation = false,
  selected = false,
  onSelect,
}: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: `driver-${driver.id}`,
    data: { driverId: driver.id },
    disabled: presentation,
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
    <div
      className={`flex ${presentation ? "h-24" : "h-20"} border-b border-slate-200/80 transition-colors`}
    >
      <div
        style={{ width: labelWidth }}
        className="sticky left-0 z-30 flex shrink-0 items-center justify-between border-r border-slate-200 bg-white px-3.5 py-2.5 shadow-xs"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {!presentation && (
            <input
              type="checkbox"
              aria-label={`Select ${driver.name}`}
              className="size-4 shrink-0 accent-indigo-600"
              checked={selected}
              disabled={driver.status !== "ACTIVE"}
              onChange={onSelect}
            />
          )}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
            {initials}
          </div>
          <div className="min-w-0">
            <p
              className={`truncate ${presentation ? "text-base" : "text-xs"} font-bold text-slate-800`}
            >
              {driver.name}
            </p>
            {vehicles.map((vehicle: any) => (
              <p
                key={vehicle.id}
                title={`${vehicle.licensePlate} · ${vehicle.model}`}
                className="truncate text-[10px] font-semibold text-blue-700"
              >
                🚌 {vehicle.licensePlate} · {vehicle.model}
              </p>
            ))}
            <p className="truncate text-[10px] font-medium text-slate-400">
              {driver.phone || "Active Driver · Charter Operations"}
            </p>
          </div>
        </div>
        {!presentation && (
          <button
            className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            onClick={onDuty}
            title="Set availability & duty spans"
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
        )}
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
