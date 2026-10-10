"use client";
import { dateParts, formatTripDate } from "@/lib/workflow-api";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { jobOf, times, type DragItem } from "./drag-item";
export function JobBlock({
  item,
  zone,
  disabled,
  onClick,
  presentation = false,
}: {
  item: DragItem;
  zone: string;
  disabled: boolean;
  onClick: () => void;
  presentation?: boolean;
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
      tabIndex={presentation ? -1 : undefined}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
        touchAction: "none",
      }}
      title={`Job #${job.id}: ${job.jobStartLocation} → ${job.jobEndLocation}\n${formatTripDate(
        times(item)[0],
        zone,
      )} — ${formatTripDate(times(item)[1], zone)}`}
      className={`w-full ${presentation ? "h-[72px] cursor-default" : "h-12 cursor-grab active:cursor-grabbing"} overflow-hidden rounded-xl border px-2.5 py-1 text-left shadow-2xs transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 ${colour}`}
    >
      <div className="flex items-center justify-between gap-1">
        <p className={`truncate ${presentation ? "text-sm" : "text-xs"} font-bold leading-tight`}>
          #{job.id} {job.booking?.customer?.name || job.jobCategory}
        </p>
        {item.type === "job" && required > 1 && (
          <span className="shrink-0 rounded bg-amber-200/90 px-1 text-[9px] font-bold">
            {allocated}/{required}
          </span>
        )}
        {item.type === "assignment" && (
          <span className="shrink-0 text-[9px] font-semibold">
            {item.value.vehicle?.licensePlate ? (
              <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">
                🚌 {item.value.vehicle.licensePlate}
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[8px] font-semibold">
                ⏳ Yard Pending
              </span>
            )}
          </span>
        )}
      </div>
      <p className={`truncate ${presentation ? "text-xs" : "text-[10px]"} text-slate-500 mt-0.5`}>
        <span className="font-semibold text-slate-700">
          {dateParts(times(item)[0], zone).time}–{dateParts(times(item)[1], zone).time}
        </span>{" "}
        · {job.jobStartLocation}
      </p>
    </button>
  );
}
