"use client";
import { useState } from "react";
import { useChangeLifecycleMutation, useGetDeletionEligibilityQuery, type Resource } from "@/services/api/operations.api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Archive, CircleAlert } from "lucide-react";
import { toast } from "react-hot-toast";
export function RecordLifecycleActions({ resource, id, inactive, onDeleted, onChanged }: { resource: Resource; id: string | number; inactive: boolean; onDeleted: () => void; onChanged?: () => void | Promise<unknown> }) {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const [change, { isLoading: saving }] = useChangeLifecycleMutation();
  const { currentData: eligibility, isFetching, isError, refetch } = useGetDeletionEligibilityQuery({ resource, id }, { skip: !open || !inactive, refetchOnMountOrArgChange: true });
  const label = inactive ? "Delete permanently" : resource === "bookings" ? "Cancel booking" : "Deactivate";
  async function submit() {
    setError("");
    try { await change({ resource, id, permanent: inactive }).unwrap(); toast.success(inactive ? "Record permanently deleted" : resource === "bookings" ? "Booking cancelled" : "Record deactivated"); setOpen(false); if (inactive) onDeleted(); else await onChanged?.(); }
    catch (e: any) { setError(e?.data?.error || "Unable to complete this action. Please retry."); if (inactive) refetch(); }
  }
  return <><Button variant="ghost" className="gap-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => { setError(""); setOpen(true); }}>{inactive ? <Trash2 size={16} /> : <Archive size={16} />}{label}</Button><Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}><DialogContent><DialogHeader><DialogTitle>{label}?</DialogTitle><DialogDescription>{inactive ? "This permanently removes an unused record. Records with linked history must be retained." : resource === "bookings" ? "Cancel this booking and its eligible dispatch assignments. Existing history will be retained." : "This record will remain accessible using the Deactivated filter. Linked history will be retained."}</DialogDescription></DialogHeader>{inactive && isFetching && <p role="status" className="text-sm text-slate-500">Checking linked records…</p>}{inactive && isError && <p role="alert" className="text-sm text-red-700">Could not check deletion eligibility. <Button variant="outline" onClick={() => refetch()}>Retry</Button></p>}{inactive && eligibility && !eligibility.eligible && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="mb-2 flex items-center gap-2 font-semibold"><CircleAlert size={16} />This record must be retained</p><ul className="list-disc space-y-1 pl-5">{eligibility.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Close</Button><Button variant="destructive" disabled={saving || (inactive && (isFetching || isError || !eligibility?.eligible))} onClick={submit}>{saving ? "Working…" : label}</Button></div></DialogContent></Dialog></>;
}
