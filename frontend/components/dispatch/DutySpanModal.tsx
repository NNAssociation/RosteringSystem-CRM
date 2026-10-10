"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEmployeeAccess } from "@/components/workplace/access";
import { dateParts } from "@/lib/workflow-api";
import { useGetDutySpansQuery, useSetDutySpanMutation } from "@/services/api/dispatch.api";
import { RootState } from "@/store";
import { closeDutySpanModal } from "@/store/dispatchUI.slice";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";

export function DutySpanModal({ drivers = [] }: { drivers?: { id: number; name: string }[] }) {
  const dispatch = useDispatch();
  const { timeZone } = useEmployeeAccess();
  const { isOpen, selectedDriverIds } = useSelector(
    (state: RootState) => state.dispatchUI.dutySpanModal,
  );
  const selectedDate = useSelector((state: RootState) => state.dispatchUI.selectedDate);
  const { currentData, isFetching, isError } = useGetDutySpansQuery(selectedDate, {
    skip: !isOpen,
    refetchOnMountOrArgChange: true,
  });
  const [save, { isLoading }] = useSetDutySpanMutation();
  const [spans, setSpans] = useState([{ startTime: "07:00", endTime: "16:00" }]);
  useEffect(() => {
    if (!isOpen || isFetching) return;
    const existing =
      selectedDriverIds.length === 1
        ? (currentData || []).filter(
            (s: any) =>
              s.driverId === selectedDriverIds[0] &&
              s.source === "MANUAL" &&
              dateParts(s.startTime, timeZone).date === selectedDate,
          )
        : [];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialize the editable shift draft after the external query finishes.
    setSpans(
      existing.length
        ? existing.map((s: any) => ({
            startTime: dateParts(s.startTime, timeZone).time,
            endTime: dateParts(s.endTime, timeZone).time,
          }))
        : [{ startTime: "07:00", endTime: "16:00" }],
    );
  }, [isOpen, isFetching, currentData, selectedDriverIds, selectedDate, timeZone]);
  async function handleSave() {
    if (!selectedDriverIds.length) {
      toast.error("Select at least one driver.");
      return;
    }
    if (spans.some((s) => !s.startTime || !s.endTime || s.startTime === s.endTime)) {
      toast.error("Provide different start and end times for every shift.");
      return;
    }
    try {
      await save({ driverIds: selectedDriverIds, date: selectedDate, spans }).unwrap();
      toast.success(`Duty spans saved for ${selectedDriverIds.length} driver(s)`);
      dispatch(closeDutySpanModal());
    } catch (error: any) {
      toast.error(error?.data?.error || "Failed to save duty spans");
    }
  }
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) dispatch(closeDutySpanModal());
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Duty Spans</DialogTitle>
          <DialogDescription>
            Shifts for {selectedDate} in {timeZone}. An earlier end time means the next day. Saving
            replaces the selected drivers’ manual shifts for this day.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-semibold">
            Apply to {selectedDriverIds.length} selected driver
            {selectedDriverIds.length === 1 ? "" : "s"}
          </p>
          <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
            {selectedDriverIds.map((id) => (
              <span
                key={id}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
              >
                {drivers.find((driver) => driver.id === id)?.name || `Driver #${id}`}
              </span>
            ))}
          </div>
        </div>
        {isError && <p role="alert">Unable to load existing shifts. Close and retry.</p>}
        <div className="space-y-3">
          {spans.map((span, index) => (
            <div key={index} className="flex items-end gap-3">
              <label className="flex-1 text-xs">
                Shift {index + 1} start
                <Input
                  type="time"
                  value={span.startTime}
                  onChange={(e) =>
                    setSpans(
                      spans.map((s, i) => (i === index ? { ...s, startTime: e.target.value } : s)),
                    )
                  }
                />
              </label>
              <label className="flex-1 text-xs">
                End
                <Input
                  type="time"
                  value={span.endTime}
                  onChange={(e) =>
                    setSpans(
                      spans.map((s, i) => (i === index ? { ...s, endTime: e.target.value } : s)),
                    )
                  }
                />
              </label>
              <Button
                variant="outline"
                aria-label={`Remove shift ${index + 1}`}
                disabled={spans.length === 1 || isLoading}
                onClick={() => setSpans(spans.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          disabled={spans.length >= 12 || isLoading}
          onClick={() => setSpans([...spans, { startTime: "14:30", endTime: "18:30" }])}
        >
          + Add Shift
        </Button>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isLoading}
            onClick={() => dispatch(closeDutySpanModal())}
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedDriverIds.length || isLoading || isFetching || isError}
            onClick={handleSave}
          >
            {isLoading ? "Saving…" : "Save Duty Spans"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
