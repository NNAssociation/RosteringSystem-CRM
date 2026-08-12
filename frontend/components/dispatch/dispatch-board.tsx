"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { useGetBoardDataQuery, useCreateAssignmentMutation } from "@/services/api/dispatch.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useWebSocket } from "@/providers/websocket-provider";
import toast from "react-hot-toast";

export function DispatchBoard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const formattedDate = format(currentDate, "yyyy-MM-dd");
  
  const { data, isLoading, isError, refetch } = useGetBoardDataQuery(formattedDate);
  const [createAssignment, { isLoading: isAssigning }] = useCreateAssignmentMutation();
  const { isConnected } = useWebSocket();

  const handleAssign = async (jobId: number, driverId: number, vehicleId: number) => {
    try {
      await createAssignment({
        jobId,
        driverId,
        vehicleId,
        scheduledStart: new Date().toISOString(), // Simplified for MVP
      }).unwrap();
      toast.success("Assignment created successfully");
    } catch (error: any) {
      toast.error(error.data?.error || "Failed to create assignment");
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  if (isError) {
    return <div className="text-red-500">Error loading dispatch board data. <Button variant="link" onClick={() => refetch()}>Retry</Button></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Dispatch Board</h2>
        <div className="flex items-center gap-4">
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Live Sync Active" : "Offline"}
          </Badge>
          <span className="text-sm text-muted-foreground">{format(currentDate, "MMMM do, yyyy")}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Unassigned Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.unassignedJobs?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unassigned jobs.</p>
            ) : (
              data?.unassignedJobs?.map((job: any) => (
                <div key={job.id} className="border p-3 rounded-md">
                  <div className="font-medium">Job #{job.id}</div>
                  <div className="text-sm text-muted-foreground truncate">{job.jobStartLocation} → {job.jobEndLocation}</div>
                  <div className="mt-2 text-xs">
                    {data?.drivers?.length > 0 && data?.vehicles?.length > 0 ? (
                       <Button 
                         size="sm" 
                         disabled={isAssigning}
                         onClick={() => handleAssign(job.id, data.drivers[0].id, data.vehicles[0].id)}
                       >
                         Auto-Assign
                       </Button>
                    ) : (
                       <span className="text-amber-500">No resources available</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Active Assignments</CardTitle>
          </CardHeader>
          <CardContent>
             {data?.assignments?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active assignments for today.</p>
            ) : (
              <div className="space-y-4">
                {data?.assignments?.map((assignment: any) => (
                  <div key={assignment.id} className="border p-4 rounded-md flex justify-between items-center">
                    <div>
                      <div className="font-medium">Job #{assignment.jobId}</div>
                      <div className="text-sm text-muted-foreground">
                        Driver ID: {assignment.driverId} | Vehicle ID: {assignment.vehicleId}
                      </div>
                    </div>
                    <Badge>{assignment.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
