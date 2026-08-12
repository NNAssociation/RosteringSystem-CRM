"use client";

import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { RootState } from "@/store";
import { setSelectedDate, setViewMode, setFilter } from "@/store/dispatchUI.slice";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SidebarDispatchNav() {
  const dispatch = useDispatch();
  const { selectedDate, viewMode, filters } = useSelector((state: RootState) => state.dispatchUI);

  const date = selectedDate ? parseISO(selectedDate) : new Date();

  return (
    <Card className="h-full border-none shadow-none rounded-none bg-transparent">
      <CardHeader className="pb-4 px-4 pt-4">
        <CardTitle className="text-lg">Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-4">
        {/* Date Picker */}
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) dispatch(setSelectedDate(format(d, "yyyy-MM-dd")));
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* View Toggle */}
        <div className="space-y-2">
          <Label>View</Label>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <Button
              variant={viewMode === "daily" ? "default" : "ghost"}
              className="flex-1 rounded-md h-8 text-xs font-medium"
              onClick={() => dispatch(setViewMode("daily"))}
            >
              Daily
            </Button>
            <Button
              variant={viewMode === "weekly" ? "default" : "ghost"}
              className="flex-1 rounded-md h-8 text-xs font-medium"
              onClick={() => dispatch(setViewMode("weekly"))}
            >
              Weekly
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Filters</h4>
          
          <div className="space-y-2">
            <Label className="text-xs">Driver</Label>
            <Input 
              placeholder="Search driver..." 
              value={filters.driver}
              onChange={(e) => dispatch(setFilter({ key: 'driver', value: e.target.value }))}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Vehicle</Label>
            <Input 
              placeholder="Search vehicle..." 
              value={filters.vehicle}
              onChange={(e) => dispatch(setFilter({ key: 'vehicle', value: e.target.value }))}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Booking Type</Label>
            <Select 
              value={filters.bookingType} 
              onValueChange={(val) => dispatch(setFilter({ key: 'bookingType', value: val === "all" ? "" : val }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="one_way">One Way</SelectItem>
                <SelectItem value="round_trip">Round Trip</SelectItem>
                <SelectItem value="repeatable">Repeatable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
