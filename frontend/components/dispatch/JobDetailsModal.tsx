"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Users, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration } from "@/lib/utils";

interface JobDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: any;
  onViewFullDetails?: () => void;
}

export function JobDetailsModal({ isOpen, onClose, assignment, onViewFullDetails }: JobDetailsModalProps) {
  if (!assignment) return null;

  const job = assignment.job;
  const booking = job?.booking;
  const startTime = new Date(assignment.scheduledStart);
  
  // Use job duration as primary, fallback to assignment span
  let duration = job?.durationHours ? Number(job.durationHours.toString()) : (new Date(assignment.scheduledEnd).getTime() - startTime.getTime()) / (1000 * 60 * 60);
  if (isNaN(duration) || duration <= 0) duration = 2;

  const endTime = new Date(startTime.getTime() + duration * 3600000);

  const statusColor = assignment.status === "CONFIRMED" ? "bg-emerald-500" 
                    : assignment.status === "IN_PROGRESS" ? "bg-amber-500"
                    : assignment.status === "COMPLETED" ? "bg-blue-500"
                    : "bg-slate-500";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
        <div className={cn("h-2 w-full", statusColor)} />
        
        <DialogHeader className="p-6 pb-2">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Job #{job?.id || "N/A"}
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {assignment.status}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-500 mt-1">
                {booking?.customer?.name || "Unknown Customer"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pt-2 space-y-6">
          {/* Trip Details */}
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="mt-1 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Pickup</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                  {job?.jobStartLocation || "Not specified"}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Dropoff</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                  {job?.jobEndLocation || "Not specified"}
                </span>
              </div>
            </div>
          </div>

          {/* Logistics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-rose-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Date</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {format(startTime, "MMM dd, yyyy")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-rose-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Time</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {format(startTime, "hh:mm aa")} - {format(endTime, "hh:mm aa")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                <Users className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Passengers</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {booking?.passengerCount || 1} Pax
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                <Clock className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Duration</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {formatDuration(duration)} Est.
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold text-xs">
            Close
          </Button>
          <Button onClick={onViewFullDetails} className="bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs gap-2">
            <ExternalLink className="h-3 w-3" />
            Full Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
