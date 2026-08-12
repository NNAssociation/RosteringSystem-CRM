"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { AssignmentBlock } from "./assignment-block";
import { differenceInMinutes, startOfDay } from "date-fns";
import { TIMELINE_START_HOUR, PIXELS_PER_MINUTE } from "./timeline";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface DriverRowProps {
  driver: any;
  assignments: any[];
  baseDate: Date;
}

export function DriverRow({ driver, assignments, baseDate }: DriverRowProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `driver-lane-${driver.id}`,
    data: {
      type: "DriverLane",
      driverId: driver.id,
    },
  });

  const timelineStart = startOfDay(baseDate).setHours(TIMELINE_START_HOUR, 0, 0, 0);

  return (
    <div className="flex items-center min-h-[60px] group border-b border-border/50 pb-2">
      {/* Driver Info Sidebar */}
      <div className="w-48 flex-shrink-0 flex items-center gap-3 pl-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {driver.name ? driver.name.substring(0, 2).toUpperCase() : "DR"}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col overflow-hidden">
          <span className="text-sm font-medium truncate">{driver.name || "Unknown Driver"}</span>
          <span className="text-xs text-muted-foreground truncate">{driver.email || "No email"}</span>
        </div>
      </div>

      {/* Droppable Timeline Lane */}
      <div 
        ref={setNodeRef}
        className={`flex-1 relative h-[50px] rounded-md transition-colors ${isOver ? "bg-primary/5 ring-1 ring-primary" : "bg-muted/10 group-hover:bg-muted/30"}`}
      >
        {/* Render actual assignments */}
        {assignments.map((assignment) => {
          const startMin = differenceInMinutes(new Date(assignment.scheduledStart), timelineStart);
          const endMin = differenceInMinutes(new Date(assignment.scheduledEnd), timelineStart);
          
          const leftOffset = Math.max(0, startMin * PIXELS_PER_MINUTE);
          const width = Math.max(20, (endMin - startMin) * PIXELS_PER_MINUTE);

          return (
            <div
              key={assignment.id}
              className="absolute top-1"
              style={{ left: `${leftOffset}px`, width: `${width}px` }}
            >
              <AssignmentBlock 
                id={`assign-${assignment.id}`}
                assignment={assignment}
                title={`Job #${assignment.jobId}`}
                durationHours={(endMin - startMin) / 60}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
