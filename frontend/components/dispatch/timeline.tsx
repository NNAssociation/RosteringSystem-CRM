"use client";

import React, { useState, useMemo } from "react";
import { format, addHours, startOfDay, differenceInMinutes } from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";

import { useGetBoardDataQuery, useUpdateAssignmentMutation, useCreateAssignmentMutation } from "@/services/api/dispatch.api";
import { DriverRow } from "./driver-row";
import { AssignmentBlock } from "./assignment-block";
import { UnassignedPool } from "./unassigned-pool";
import { Card } from "@/components/ui/card";
import toast from "react-hot-toast";

// Constants for timeline scaling
export const TIMELINE_START_HOUR = 6; // Starts at 6 AM
export const TIMELINE_END_HOUR = 22;  // Ends at 10 PM
export const PIXELS_PER_MINUTE = 2; // e.g., 60 mins = 120px width

export function Timeline() {
  const [currentDate] = useState(new Date());
  const formattedDate = format(currentDate, "yyyy-MM-dd");
  
  const { data, isLoading } = useGetBoardDataQuery(formattedDate);
  const [updateAssignment] = useUpdateAssignmentMutation();
  const [createAssignment] = useCreateAssignmentMutation();

  const [activeId, setActiveId] = useState<string | null>(null);

  // Generate hours array for the timeline header
  const hours = useMemo(() => {
    const arr = [];
    const base = startOfDay(currentDate);
    for (let i = TIMELINE_START_HOUR; i <= TIMELINE_END_HOUR; i++) {
      arr.push(addHours(base, i));
    }
    return arr;
  }, [currentDate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return; // Dropped outside

    const activeData = active.data.current;
    const overData = over.data.current;

    // We only care about dropping ONTO a driver lane
    if (overData?.type !== "DriverLane") return;

    const driverId = overData.driverId;
    
    // Calculate new start time based on X drop position
    // over.rect gives the lane's rectangle. We find offset from left
    const laneRect = over.rect;
    const dropOffset = event.active.rect.current.translated.left - laneRect.left;
    
    // Ensure we don't drop before the start hour
    const safeOffset = Math.max(0, dropOffset);
    const minutesFromStart = Math.round(safeOffset / PIXELS_PER_MINUTE);
    
    const newStartTime = new Date(startOfDay(currentDate));
    newStartTime.setHours(TIMELINE_START_HOUR, minutesFromStart, 0, 0);

    try {
      if (activeData?.type === "UnassignedJob") {
        // Creating a NEW assignment from an unassigned job
        const job = activeData.job;
        // Default to 2 hours if job duration is missing
        const durationHours = job.durationHours ? Number(job.durationHours) : 2;
        const newEndTime = new Date(newStartTime.getTime() + durationHours * 60 * 60 * 1000);

        await createAssignment({
          jobId: job.id,
          driverId,
          // Just taking the first vehicle for MVP — in a real app, you'd have a vehicle lane or selector
          vehicleId: data?.vehicles?.[0]?.id, 
          scheduledStart: newStartTime.toISOString(),
          scheduledEnd: newEndTime.toISOString(),
        }).unwrap();
        toast.success(`Assigned Job #${job.id} to Driver #${driverId}`);
      } else if (activeData?.type === "Assignment") {
        // Moving an existing assignment
        const assignment = activeData.assignment;
        
        // Calculate the new end time based on original duration
        const originalStart = new Date(assignment.scheduledStart);
        const originalEnd = assignment.scheduledEnd ? new Date(assignment.scheduledEnd) : new Date(originalStart.getTime() + 2 * 3600000);
        const durationMs = originalEnd.getTime() - originalStart.getTime();
        const newEndTime = new Date(newStartTime.getTime() + durationMs);

        await updateAssignment({
          id: assignment.id,
          data: {
            driverId,
            scheduledStart: newStartTime.toISOString(),
            scheduledEnd: newEndTime.toISOString(),
            version: assignment.version,
          }
        }).unwrap();
        toast.success("Assignment updated");
      }
    } catch (error: any) {
      toast.error(error.data?.error || "Failed to update assignment");
    }
  };

  const getActiveItem = () => {
    if (!activeId || !data) return null;
    if (String(activeId).startsWith("job-")) {
      const jobId = Number(String(activeId).replace("job-", ""));
      return data.unassignedJobs?.find((j: any) => j.id === jobId);
    }
    if (String(activeId).startsWith("assign-")) {
      const assignId = Number(String(activeId).replace("assign-", ""));
      return data.assignments?.find((a: any) => a.id === assignId);
    }
    return null;
  };

  const activeItem = getActiveItem();
  const timelineWidth = (TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1) * 60 * PIXELS_PER_MINUTE;

  if (isLoading) return <div className="p-8 text-center">Loading Timeline...</div>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToWindowEdges]}
    >
      <div className="flex flex-col md:flex-row h-full gap-4">
        {/* Sidebar: Unassigned Jobs */}
        <div className="w-full md:w-64 flex-shrink-0">
          <UnassignedPool jobs={data?.unassignedJobs || []} />
        </div>

        {/* Main Timeline */}
        <Card className="flex-1 overflow-x-auto overflow-y-auto p-4 border bg-background/50">
          <div style={{ minWidth: `${timelineWidth + 200}px` }}>
            {/* Timeline Header (Hours) */}
            <div className="flex mb-4 sticky top-0 bg-background/90 z-10 py-2 border-b">
              <div className="w-48 flex-shrink-0 font-medium pl-2">Driver / Vehicle</div>
              <div className="flex-1 flex relative h-6">
                {hours.map((hour) => (
                  <div
                    key={hour.toISOString()}
                    className="absolute text-xs text-muted-foreground border-l pl-1 h-full"
                    style={{
                      left: `${differenceInMinutes(hour, startOfDay(currentDate).setHours(TIMELINE_START_HOUR)) * PIXELS_PER_MINUTE}px`,
                    }}
                  >
                    {format(hour, "HH:mm")}
                  </div>
                ))}
              </div>
            </div>

            {/* Driver Lanes */}
            <div className="space-y-2 relative">
              {data?.drivers?.map((driver: any) => (
                <DriverRow 
                  key={driver.id} 
                  driver={driver} 
                  assignments={data?.assignments?.filter((a: any) => a.driverId === driver.id) || []}
                  baseDate={currentDate}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Drag Overlay for smooth visuals */}
      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }),
        }}
      >
        {activeId && activeItem ? (
          String(activeId).startsWith("job-") ? (
            <AssignmentBlock title={`Job #${activeItem.id}`} durationHours={activeItem.durationHours || 2} isDragging />
          ) : (
            <AssignmentBlock 
              title={`Job #${activeItem.jobId}`} 
              durationHours={differenceInMinutes(new Date(activeItem.scheduledEnd), new Date(activeItem.scheduledStart)) / 60} 
              isDragging 
            />
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
