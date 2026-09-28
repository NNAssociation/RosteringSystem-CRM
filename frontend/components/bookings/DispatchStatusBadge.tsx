import { Badge } from "@/components/ui/badge";
const styles: Record<string, string> = {
  NOT_READY: "bg-slate-100 text-slate-700 border-slate-200",
  UNASSIGNED: "bg-amber-100 text-amber-800 border-amber-200",
  PARTIALLY_ASSIGNED: "bg-blue-100 text-blue-800 border-blue-200",
  ASSIGNED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  COMPLETED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
};
export function DispatchStatusBadge({ status = "NOT_READY" }: { status?: string }) {
  return <Badge variant="outline" className={styles[status] || styles.NOT_READY}>{status.replaceAll("_", " ").toLowerCase().replace(/^./, c => c.toUpperCase())}</Badge>;
}
