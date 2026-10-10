"use client";

import { Button } from "@/components/ui/button";
import type { BookingTrip, RouteCalculation } from "@/types/booking-workflow";
import { ArrowLeft, ArrowRight, Calendar, Clock, MapPin, RotateCcw } from "lucide-react";
import { BookingRouteEditor } from "../BookingRouteEditor";
import { BookingSectionTitle } from "../BookingVisuals";
import { FIELD_INPUT_CLASS } from "../config/booking-workflow.config";

interface Step1Props {
  trip: BookingTrip;
  onPreview: (value: RouteCalculation) => void;
  bookingId?: string;
  locked: boolean;
  busy: boolean;
  onChange: <K extends keyof BookingTrip>(key: K, value: BookingTrip[K]) => void;
  onBatchChange: (partial: Partial<BookingTrip>) => void;
  onSaveContinue: () => void;
  onBack?: () => void;
  onOpenRoutePlanning?: () => void;
  setNotice: (msg: string) => void;
}

export function BookingStep1Locations({
  trip,
  onPreview,
  bookingId: _bookingId,
  locked,
  busy,
  onChange,
  onBatchChange,
  onSaveContinue,
  onBack,
  setNotice: _setNotice,
}: Step1Props) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 space-y-6 shadow-2xs">
      <BookingSectionTitle
        title="Trip locations & itinerary"
        description="Design the route, configure passenger pickup/drop-off stops, and shape roads with via waypoints."
        icon={MapPin}
      />

      <BookingRouteEditor
        trip={trip}
        disabled={locked || busy}
        onChange={onBatchChange}
        onPreview={onPreview}
      />

      {/* Round Trip Return Journey Timing Card */}
      {trip.bookingType === "round_trip" && (
        <div className="space-y-4 rounded-2xl border border-blue-200/80 bg-blue-50/25 p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-blue-100 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <RotateCcw className="h-3.5 w-3.5" />
              </span>
              <span>Return Journey Schedule</span>
            </div>
            <span className="text-xs text-blue-700 bg-white border border-blue-200 px-2.5 py-0.5 rounded-full font-semibold shadow-2xs">
              Round Trip Return
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5 mb-1.5 text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                Return Arrival Date
              </span>
              <input
                disabled={locked || busy}
                className={FIELD_INPUT_CLASS}
                type="date"
                value={trip.returnEndDate || ""}
                onChange={(e) => onChange("returnEndDate", e.target.value)}
              />
            </label>

            <label className="block text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5 mb-1.5 text-slate-600">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                Return Arrival Time
              </span>
              <input
                disabled={locked || busy}
                className={FIELD_INPUT_CLASS}
                type="time"
                value={trip.returnEndTime || ""}
                onChange={(e) => onChange("returnEndTime", e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      {/* Action Footer Navigation */}
      <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
        {onBack ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onBack}
            className="gap-2 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 px-5 text-xs font-semibold h-10 shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Basic Details</span>
          </Button>
        ) : (
          <div />
        )}

        <Button
          type="button"
          disabled={busy}
          onClick={onSaveContinue}
          className="gap-2 bg-blue-600 text-white hover:bg-blue-700 px-6 py-2.5 text-xs font-bold rounded-xl h-10 shadow-sm"
        >
          <span>Save & prepare quotation</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
