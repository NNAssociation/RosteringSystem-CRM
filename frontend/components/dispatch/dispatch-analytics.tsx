"use client";

import React from "react";
import { useGetAnalyticsQuery } from "@/services/api/dispatch.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Activity, Car, CheckCircle, Clock } from "lucide-react";

export function DispatchAnalytics({ date }: { date?: string }) {
  const queryDate = date || format(new Date(), "yyyy-MM-dd");
  const { data, isLoading, error } = useGetAnalyticsQuery(queryDate);

  if (isLoading) return <div className="animate-pulse h-24 bg-slate-100 rounded-xl"></div>;
  if (error || !data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalAssignments}</div>
          <p className="text-xs text-muted-foreground">For {format(new Date(queryDate), "MMM d, yyyy")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-amber-600">Unassigned Jobs</CardTitle>
          <Clock className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{data.unassignedJobs}</div>
          <p className="text-xs text-muted-foreground">Action required</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-emerald-600">Completed Trips</CardTitle>
          <CheckCircle className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">{data.completedAssignments}</div>
          <p className="text-xs text-muted-foreground">Successfully finished</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Driver Utilization</CardTitle>
          <Car className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.driverUtilization}%</div>
          <p className="text-xs text-muted-foreground">{data.assignedDrivers} out of {data.activeDrivers} active drivers</p>
        </CardContent>
      </Card>
    </div>
  );
}
