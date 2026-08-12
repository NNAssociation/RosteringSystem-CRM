"use client";

import React, { useState, useMemo } from "react";
import { BookingCard } from "./BookingCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Filter, Zap, ZapOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { calculateDistance, cn } from "@/lib/utils";

interface UnassignedBookingPanelProps {
  jobs: any[];
  driverLocation?: { lat: number; lng: number } | null;
}

export function UnassignedBookingPanel({ jobs, driverLocation }: UnassignedBookingPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [smartFilter, setSmartFilter] = useState(true);

  const processedJobs = useMemo(() => {
    let result = jobs.map(job => {
      const jobLat = job.jobStartLat ?? job.booking?.pickupLat;
      const jobLng = job.jobStartLng ?? job.booking?.pickupLng;

      const distance = (driverLocation && jobLat && jobLng)
        ? calculateDistance(driverLocation.lat, driverLocation.lng, Number(jobLat), Number(jobLng))
        : null;
      return { ...job, distance };
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((job) =>
        job.id?.toString().includes(term) ||
        job.customerName?.toLowerCase().includes(term) ||
        job.jobStartLocation?.toLowerCase().includes(term) ||
        job.jobEndLocation?.toLowerCase().includes(term)
      );
    }

    if (smartFilter && driverLocation) {
      result.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    return result;
  }, [jobs, searchTerm, smartFilter, driverLocation]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      <div className="pb-3 px-4 pt-0 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            Unassigned
            <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600 text-[10px] h-5 min-w-[20px] flex items-center justify-center border-none">
              {jobs.length}
            </Badge>
          </h4>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={!driverLocation}
              className={cn(
                "h-8 w-8 transition-all rounded-full",
                smartFilter && driverLocation 
                  ? "text-amber-500 bg-amber-100/50 hover:bg-amber-100 ring-2 ring-amber-200/50 shadow-sm" 
                  : "text-slate-300 bg-slate-50/50"
              )}
              onClick={() => setSmartFilter(!smartFilter)}
              title={!driverLocation ? "No recent driver location found to sort by" : (smartFilter ? "Disable Smart Sort" : "Enable Smart Sort")}
            >
              {smartFilter && driverLocation ? (
                <Zap className="h-4 w-4 fill-current animate-in zoom-in duration-300" />
              ) : (
                <ZapOff className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-100 rounded-full">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-300" />
          <Input
            type="search"
            placeholder="Search bookings..."
            className="w-full pl-8 h-9 bg-slate-50 border-slate-100 text-xs rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1 h-full">
        <div className="p-4 space-y-3 pb-20">
          {processedJobs.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
              <p className="text-sm text-slate-400 font-medium">No unassigned jobs</p>
              <p className="text-[10px] text-slate-300 mt-1 uppercase font-bold">All caught up!</p>
            </div>
          ) : (
            processedJobs.map((job) => (
              <BookingCard key={job.id} job={job} distance={job.distance} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
