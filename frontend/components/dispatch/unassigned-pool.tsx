"use client";

import React from "react";
import { AssignmentBlock } from "./assignment-block";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

export function UnassignedPool({ jobs }: { jobs: any[] }) {
  return (
    <Card className="h-full flex flex-col bg-muted/20 border-r rounded-none md:rounded-lg">
      <CardHeader className="py-3 px-4 border-b bg-card">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          Unassigned Jobs ({jobs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
        {jobs.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            All jobs assigned for this window.
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="w-full">
              <AssignmentBlock 
                job={job} 
                title={`Job #${job.id}`} 
                durationHours={job.durationHours ? Number(job.durationHours) : 2} 
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
