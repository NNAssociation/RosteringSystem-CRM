"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Users, Clock, MapPin, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn, formatDuration } from "@/lib/utils";

interface BookingCardProps {
  job: any;
  distance?: number | null;
}

export function BookingCard({ job, distance }: BookingCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `job-${job.id}`,
    data: {
      type: "UnassignedJob",
      job,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  // Safe fallback values
  const customerName = job.booking?.customer?.name || `Customer #${job.id}`;
  const startLoc = job.jobStartLocation?.split(',')[0] || "Unknown Pickup";
  const endLoc = job.jobEndLocation?.split(',')[0] || "Unknown Dropoff";
  
  // Calculate duration if not provided
  let duration = 2;
  if (job.durationHours) {
    duration = Number(job.durationHours.toString());
  } else if (job.jobStartDateTime && job.jobEndDateTime) {
     const start = new Date(job.jobStartDateTime);
     const end = new Date(job.jobEndDateTime);
     const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
     if (diff > 0) duration = Number(diff.toFixed(1));
  }
  
  const paxCount = job.booking?.passengerCount || 1;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none group">
      <Card className={`border overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/50 cursor-grab active:cursor-grabbing ${isDragging ? 'ring-2 ring-primary shadow-lg' : ''}`}>
        <div className="flex bg-slate-50 dark:bg-slate-900 border-b p-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
            <span className="font-semibold text-sm">#{job.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {distance !== null && distance !== undefined && (
              <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-100 flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                <MapPin className="h-2.5 w-2.5" />
                {distance.toFixed(1)} km
              </Badge>
            )}
            {job.booking?.noOfVehicles && job.booking.noOfVehicles > 1 && (
              <Badge variant="outline" className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border-indigo-200">
                {job.booking.noOfVehicles} Vehicles
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-extrabold uppercase border shadow-none",
                (job.bookingType || job.booking?.bookingType) === "round_trip"
                  ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200"
                  : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200"
              )}
            >
              {(job.bookingType || job.booking?.bookingType) === "round_trip" ? "Round-Trip" : "One-Way"}
            </Badge>
          </div>
        </div>
        <CardContent className="p-3 space-y-3">
          <div className="font-medium text-sm">{customerName}</div>
          
          <div className="space-y-1.5 relative">
             <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border"></div>
             <div className="flex items-start gap-2 text-xs text-muted-foreground relative z-10 bg-card">
               <MapPin className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
               <span className="truncate" title={startLoc}>{startLoc}</span>
             </div>
             <div className="flex items-start gap-2 text-xs text-muted-foreground relative z-10 bg-card">
               <MapPin className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
               <span className="truncate" title={endLoc}>{endLoc}</span>
             </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{paxCount} Pax</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                {job.jobStartDateTime ? format(new Date(job.jobStartDateTime), "hh:mm aa") + " • " : ""}
                {formatDuration(duration)} Est.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
