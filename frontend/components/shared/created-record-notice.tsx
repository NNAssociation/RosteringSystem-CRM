"use client";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { Button } from "@/components/ui/button";
export function useCreationVersion(resource: string) { return useSelector((s: RootState) => s.recordChanges.creations[resource]?.version || 0); }
export function CreatedRecordNotice({ resource, records, visible, clear }: { resource: string; records: { id: string | number }[]; visible: { id: string | number }[]; clear: () => void }) {
  const created = useSelector((s: RootState) => s.recordChanges.creations[resource]);
  if (!created || !records.some(r => String(r.id) === String(created.id)) || visible.some(r => String(r.id) === String(created.id))) return null;
  return <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">Your new record is hidden by the current filters.<Button variant="outline" onClick={clear}>Clear filters</Button></div>;
}
