"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BookingCategory, BookingTrip } from "@/types/booking-workflow";
import { Bus, CalendarDays, ClipboardList, UserRound } from "lucide-react";
import { CustomerSelector } from "../CustomerSelector";
import { BookingSectionTitle } from "../BookingVisuals";
import { AUSTRALIAN_TIMEZONES, FIELD_INPUT_CLASS } from "../config/booking-workflow.config";

interface Step0Props {
  trip: BookingTrip;
  bookingId?: string;
  locked: boolean;
  busy: boolean;
  onChange: <K extends keyof BookingTrip>(key: K, value: BookingTrip[K]) => void;
  onBatchChange: (partial: Partial<BookingTrip>) => void;
  onSaveContinue: () => void;
  setNotice: (msg: string) => void;
}

export function BookingStep0BasicDetails({
  trip,
  bookingId,
  locked,
  busy,
  onChange,
  onBatchChange,
  onSaveContinue,
  setNotice,
}: Step0Props) {
  return (
    <div className="rounded-2xl border bg-white p-6 space-y-5">
      <BookingSectionTitle
        title="Basic trip details"
        description="Who is travelling, and when? Start with the essentials."
        icon={ClipboardList}
      />
      <fieldset disabled={locked || busy} className="space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-semibold text-slate-700">
          <UserRound size={16} className="text-blue-500" />
          Customer information
        </div>

        {!bookingId && (
          <CustomerSelector
            customerName={trip.customerName}
            customerEmail={trip.customerEmail}
            customerId={trip.customerId}
            onSelect={(id, name, email) => {
              onBatchChange({
                customerId: Number(id),
                customerName: name,
                customerEmail: email || "",
                subject: trip.subject?.trim() ? trip.subject : `Trip for ${name}`,
              });
            }}
            onClear={() => {
              onBatchChange({
                customerId: undefined,
                customerName: "",
                customerEmail: "",
              });
            }}
            onAddNew={() => {
              onBatchChange({
                customerId: undefined,
                customerName: "",
                customerEmail: "",
              });
              setNotice("Enter the new customer’s name and email below.");
            }}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name">
            <Input
              value={trip.customerName}
              disabled={!!bookingId || !!trip.customerId}
              onChange={(e) => onChange("customerName", e.target.value)}
              placeholder="Full name or company"
            />
          </Field>
          <Field label="Customer email">
            <Input
              type="email"
              value={trip.customerEmail}
              disabled={!!bookingId || !!trip.customerId}
              onChange={(e) => onChange("customerEmail", e.target.value)}
              placeholder="client@example.com"
            />
          </Field>
        </div>

        <Field label="Trip subject">
          <Input
            value={trip.subject}
            onChange={(e) => onChange("subject", e.target.value)}
            placeholder="e.g. Airport transfer for conference guests (optional, will auto-fill if left blank)"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trip type">
            <select
              className={FIELD_INPUT_CLASS}
              value={trip.bookingType}
              onChange={(e) => onChange("bookingType", e.target.value as BookingCategory)}
            >
              <option value="one_way">One way</option>
              <option value="round_trip">Round trip</option>
              <option value="repeatable">Recurring</option>
            </select>
          </Field>
          <Field label="Timezone">
            <select
              className={FIELD_INPUT_CLASS}
              value={trip.timeZone}
              onChange={(e) => onChange("timeZone", e.target.value)}
            >
              {AUSTRALIAN_TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 pt-3 text-sm font-semibold text-slate-700">
          <CalendarDays size={16} className="text-blue-500" />
          Trip schedule
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Departure date">
            <Input
              type="date"
              value={trip.date}
              onChange={(e) => onChange("date", e.target.value)}
            />
          </Field>
          <Field label="Departure time">
            <Input
              type="time"
              value={trip.startTime}
              onChange={(e) => onChange("startTime", e.target.value)}
            />
          </Field>
          <Field label="Arrival date">
            <Input
              type="date"
              value={trip.endDate || trip.date}
              onChange={(e) => onChange("endDate", e.target.value)}
            />
          </Field>
          <Field label="Arrival time">
            <Input
              type="time"
              value={trip.endTime}
              onChange={(e) => onChange("endTime", e.target.value)}
            />
          </Field>
        </div>

        {trip.bookingType === "round_trip" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Return departure date">
              <Input
                type="date"
                value={trip.returnDate || trip.date}
                onChange={(e) => onChange("returnDate", e.target.value)}
              />
            </Field>
            <Field label="Return departure time">
              <Input
                type="time"
                value={trip.returnTime}
                onChange={(e) => onChange("returnTime", e.target.value)}
              />
            </Field>
          </div>
        )}

        {trip.bookingType === "repeatable" && (
          <div className="rounded-xl bg-slate-50 p-4 space-y-3">
            <Field label="Repeat">
              <select
                className={FIELD_INPUT_CLASS}
                value={trip.recurrenceRule.type}
                onChange={(e) =>
                  onChange("recurrenceRule", {
                    ...trip.recurrenceRule,
                    type: e.target.value,
                  })
                }
              >
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First date">
                <Input
                  type="date"
                  value={trip.recurrenceRule.startDate}
                  onChange={(e) =>
                    onChange("recurrenceRule", {
                      ...trip.recurrenceRule,
                      startDate: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Last date">
                <Input
                  type="date"
                  value={trip.recurrenceRule.endDate}
                  onChange={(e) =>
                    onChange("recurrenceRule", {
                      ...trip.recurrenceRule,
                      endDate: e.target.value,
                    })
                  }
                />
              </Field>
            </div>
            {trip.recurrenceRule.type === "weekly" && (
              <div className="flex flex-wrap gap-3">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                  <label key={day} className="text-sm flex gap-1 items-center">
                    <input
                      type="checkbox"
                      checked={trip.recurrenceRule.days.includes(i)}
                      onChange={(e) =>
                        onChange("recurrenceRule", {
                          ...trip.recurrenceRule,
                          days: e.target.checked
                            ? [...trip.recurrenceRule.days, i]
                            : trip.recurrenceRule.days.filter((d) => d !== i),
                        })
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 pt-3 text-sm font-semibold text-slate-700">
          <Bus size={16} className="text-blue-500" />
          Vehicle specification & fleet requirements
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Vehicle Type Selection */}
          <div className="space-y-2">
            <label className="block text-sm text-slate-600 font-medium">Vehicle type</label>
            <div className="flex rounded-xl border border-slate-200 bg-slate-100/70 p-1 gap-1 h-10">
              <button
                type="button"
                disabled={locked || busy}
                onClick={() => onChange("vehicleType", "Coach")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                  (trip.vehicleType || "Coach") === "Coach"
                    ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Coach</span>
                <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                  (53-57 seats)
                </span>
              </button>
              <button
                type="button"
                disabled={locked || busy}
                onClick={() => onChange("vehicleType", "Bus")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                  trip.vehicleType === "Bus"
                    ? "bg-white text-emerald-700 shadow-xs border border-emerald-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Bus</span>
                <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                  (24-28 seats)
                </span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400 block">
              {(trip.vehicleType || "Coach") === "Coach"
                ? "Standard luxury / long-distance coach"
                : "Charter / school transfer bus"}
            </span>
          </div>

          {/* Vehicle Count */}
          <div className="space-y-2">
            <Field label="Vehicles required (Count)">
              <Input
                type="number"
                min={1}
                max={20}
                value={trip.noOfVehicles || 1}
                onChange={(e) => onChange("noOfVehicles", Math.max(1, Number(e.target.value) || 1))}
                className="font-bold text-slate-900"
              />
            </Field>
            <span className="text-[11px] text-slate-400 block">
              Quantities multiply distance rate in quotation
            </span>
          </div>

          {/* Passenger Count */}
          <div className="space-y-2">
            <Field label="Total passengers">
              <Input
                type="number"
                min={1}
                value={trip.passengerCount || 1}
                onChange={(e) =>
                  onChange("passengerCount", Math.max(1, Number(e.target.value) || 1))
                }
              />
            </Field>
            <span className="text-[11px] text-slate-400 block">Total passenger manifest count</span>
          </div>
        </div>

        <Field label="Internal notes (not shown to customer)">
          <textarea
            className={FIELD_INPUT_CLASS}
            rows={3}
            value={trip.bookingDetails}
            onChange={(e) => onChange("bookingDetails", e.target.value)}
          />
        </Field>
      </fieldset>

      <Button disabled={busy} onClick={onSaveContinue}>
        Save & continue
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-slate-600 space-y-2">
      <span>{label}</span>
      {children}
    </label>
  );
}
