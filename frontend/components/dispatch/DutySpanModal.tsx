"use client";

import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { closeDutySpanModal, setDutySpan } from "@/store/dispatchUI.slice";
import { format } from "date-fns";
import { useSetDutySpanMutation } from "@/services/api/dispatch.api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";

export function DutySpanModal() {
  const dispatch = useDispatch();
  const [setDutySpanApi] = useSetDutySpanMutation();
  const { isOpen, selectedDriverIds } = useSelector(
    (state: RootState) => state.dispatchUI.dutySpanModal
  );
  const selectedDate = useSelector((state: RootState) => state.dispatchUI.selectedDate);

  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("16:00");

  const handleSave = async () => {
    if (!startTime || !endTime) {
      toast.error("Please provide both start and end times.");
      return;
    }

    // Convert time to full ISO string for the selected date
    const createIsoString = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(":");
      const date = new Date(selectedDate);
      date.setHours(Number(hours), Number(minutes), 0, 0);
      return date.toISOString();
    };

    const isoStart = createIsoString(startTime);
    const isoEnd = createIsoString(endTime);

    try {
      await setDutySpanApi({
        driverIds: selectedDriverIds,
        date: selectedDate,
        startTime: isoStart,
        endTime: isoEnd,
      }).unwrap();

      selectedDriverIds.forEach((driverId) => {
        dispatch(
          setDutySpan({
            driverId,
            date: selectedDate,
            startTime: isoStart,
            endTime: isoEnd,
          })
        );
      });

      toast.success(`Duty span set for ${selectedDriverIds.length} driver(s)`);
      dispatch(closeDutySpanModal());
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed: ${err.message || JSON.stringify(err.data) || JSON.stringify(err)}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && dispatch(closeDutySpanModal())}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Duty Span</DialogTitle>
          <DialogDescription>
            Define the working hours for the selected driver(s) on {format(new Date(selectedDate), "MMM do, yyyy")}.
            Job assignments are restricted to this window.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="start-time" className="text-right">
              Start Time
            </Label>
            <Input
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="end-time" className="text-right">
              End Time
            </Label>
            <Input
              id="end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => dispatch(closeDutySpanModal())}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Duty Span</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
