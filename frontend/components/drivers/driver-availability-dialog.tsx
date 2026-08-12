"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddDriverAvailabilityMutation, useGetDriverAvailabilityQuery } from "@/services/api/drivers.api";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { CalendarClock, Plus, Trash2 } from "lucide-react";

export function DriverAvailabilityDialog({ driverId, driverName }: { driverId: number, driverName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: blocks, isLoading } = useGetDriverAvailabilityQuery(driverId, { skip: !isOpen });
  const [addAvailability, { isLoading: isAdding }] = useAddDriverAvailabilityMutation();

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime) return;

    try {
      await addAvailability({
        driverId,
        data: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          reason,
          isBlocked: true,
        }
      }).unwrap();
      toast.success("Availability blocked added");
      setStartTime("");
      setEndTime("");
      setReason("");
    } catch (error: any) {
      toast.error(error.data?.error || "Failed to add block");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarClock className="h-4 w-4" />
          Availability
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Availability: {driverName}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleAdd} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input type="datetime-local" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input type="datetime-local" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input placeholder="e.g. Sick leave, vacation" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button type="submit" disabled={isAdding} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Add Block
          </Button>
        </form>

        <div className="mt-6">
          <h4 className="text-sm font-semibold mb-3">Current Blocks</h4>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : blocks?.length === 0 ? (
            <div className="text-sm text-muted-foreground">No blocks set.</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {blocks?.map((block: any) => (
                <div key={block.id} className="flex justify-between items-center bg-muted/30 p-2 rounded-md border text-sm">
                  <div>
                    <div className="font-medium">{block.reason || "Blocked"}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(block.startTime), "MMM d, HH:mm")} - {format(new Date(block.endTime), "HH:mm")}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive h-6 w-6">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
