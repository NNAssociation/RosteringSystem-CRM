import { Archive, Ban, CircleCheck, Clock3 } from "lucide-react";

export function RecordStatusBadge({ status = "UNKNOWN" }: { status?: string }) {
  const value = status.toUpperCase().replaceAll(" ", "_");
  const retired = value === "INACTIVE" || value === "DEACTIVATED";
  const cancelled = value === "CANCELLED";
  const active = ["ACTIVE", "AVAILABLE", "CONFIRMED", "COMPLETED"].includes(value);
  const blue = ["ON_LEAVE", "ON_TRIP", "IN_USE", "ASSIGNED"].includes(value);
  const Icon = retired ? Archive : cancelled ? Ban : active ? CircleCheck : Clock3;
  const label = retired ? "Deactivated" : value.toLowerCase().replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
  const colour = retired ? "border-rose-200 bg-rose-50 text-rose-700" : cancelled || value === "DECLINED" ? "border-red-300 bg-red-100 text-red-800" : active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : blue ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-800";
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${colour}`}><Icon size={13} className={retired ? "text-rose-500" : cancelled ? "text-red-600" : ""} aria-hidden="true" />{label}</span>;
}

export function InactiveRecordNotice({ cancelled = false }: { cancelled?: boolean }) {
  const Icon = cancelled ? Ban : Archive;
  return <div role="status" className="m-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-rose-900"><Icon size={17} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" /><div><p className="text-sm font-semibold">{cancelled ? "This booking is cancelled" : "This record is deactivated"}</p><p className="mt-1 text-xs leading-relaxed text-rose-700">{cancelled ? "Retained for reference. Cancelled trips are not available for dispatch." : "Retained for reference. You can review its details or reactivate it using Edit."}</p></div></div>;
}
