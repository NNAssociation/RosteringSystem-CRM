"use client";

import { Button } from "@/components/ui/button";
import { formatTripDate } from "@/lib/workflow-api";
import type {
  ActivityEntry,
  BookingRecord,
  QuotationDelivery,
  QuotationRevision,
} from "@/types/booking-workflow";
import Link from "next/link";
import { useState } from "react";
import { BookingSectionTitle, WorkflowStatus, bookingStepIcons } from "./BookingVisuals";
import { DispatchStatusBadge } from "./DispatchStatusBadge";
import { QuotationPreview } from "./QuotationPreview";

interface BookingRecordViewProps {
  booking: BookingRecord;
  quotes: QuotationRevision[];
  activity: ActivityEntry[];
  step: number;
  download: (id: number) => void;
  send: (id: number) => void;
  busy: boolean;
  emailConfigured: boolean;
  onEdit?: () => void;
}

export function BookingRecordView({
  booking: b,
  quotes,
  activity,
  step,
  download,
  send,
  busy,
  emailConfigured,
  onEdit,
}: BookingRecordViewProps) {
  const [revisionId, setRevisionId] = useState<number | null>(null);
  const q = quotes.find((quote) => quote.id === revisionId) || quotes[0];

  const date = (value?: string | null) => (value ? formatTripDate(value, b.timeZone) : "—");
  const field = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm">{value ?? "—"}</dd>
    </div>
  );

  const locations: import("@/types").StructuredLocation[] = b.outboundItinerary || [
    { address: b.pickupLocation, lat: b.pickupLat ?? undefined, lng: b.pickupLng ?? undefined },
    ...(b.stops || []),
    { address: b.dropoffLocation, lat: b.dropoffLat ?? undefined, lng: b.dropoffLng ?? undefined },
  ];

  return (
    <div className="space-y-5">
      {/* Step 0: Basic trip details */}
      {step === 0 && (
        <section className="rounded-2xl border bg-white p-6">
          <div className="mb-6">
            <BookingSectionTitle
              title="Basic trip details"
              description="Saved customer and journey information."
            />
          </div>
          <dl className="grid gap-5 sm:grid-cols-2">
            {field("Customer", b.customerName)}
            {field("Email", b.customerEmail)}
            {field("Phone", b.customer?.phone1)}
            {field("Company", b.customer?.company)}
            {field("Subject", b.subject)}
            {field("Trip type", b.bookingType?.replaceAll("_", " "))}
            {field("Departure", date(b.startTime || b.startDateTime))}
            {field("Arrival", date(b.endTime || b.endDateTime))}
            {field("Timezone", b.timeZone)}
            {field("Return departure", date(b.returnTime || b.returnDateTime))}
            {field("Passengers", b.passengerCount)}
            {field("Vehicles required", b.noOfVehicles)}
            {field("Trip count", b.tripCount)}
            {field("Confirmation source", b.confirmationSource?.replaceAll("_", " "))}
            {field("Confirmed at", date(b.confirmedAt))}
            {field("Internal notes", b.bookingDetails || b.inquiryDetails || "—")}
            {field("Created", date(b.createdAt))}
            {field("Last updated", date(b.updatedAt))}
          </dl>
          {b.bookingType === "repeatable" && b.recurrenceRule && (
            <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm">
              <h3 className="font-semibold">Recurring schedule</h3>
              <p className="mt-2">
                {b.recurrenceRule.type} · {b.recurrenceRule.startDate} to {b.recurrenceRule.endDate}
              </p>
              {b.recurrenceRule.days && b.recurrenceRule.days.length > 0 && (
                <p>
                  {b.recurrenceRule.days
                    .map(
                      (d: number) =>
                        [
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ][d],
                    )
                    .join(", ")}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Step 1: Locations */}
      {step === 1 && (
        <section className="rounded-2xl border bg-white p-6 space-y-5">
          <h2 className="text-xl font-semibold">Trip locations</h2>
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              Edit trip locations
            </Button>
          )}
          <ol className="space-y-4">
            {locations.map((l, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  {i === 0
                    ? "Pickup"
                    : i === locations.length - 1
                      ? "Destination"
                      : l.kind === "VIA"
                        ? `Via ${i} — pass through, no passenger stop`
                        : `Stop ${i}`}
                </p>
                <p className="mt-1 text-sm">{l.address || "Not provided"}</p>
              </li>
            ))}
          </ol>
          {b.bookingType === "round_trip" && b.returnItinerary?.length ? (
            <>
              <h3 className="font-semibold">Return itinerary</h3>
              <ol className="space-y-2">
                {b.returnItinerary.map((p, i) => (
                  <li key={p.id || i}>
                    {i + 1}. {p.kind === "VIA" ? "Via — pass through: " : ""}
                    {p.address}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </section>
      )}

      {/* Step 2 & 3: Quotation details */}
      {(step === 2 || step === 3) && (
        <section className="space-y-4">
          <BookingSectionTitle
            title={step === 2 ? "Quotation details" : "Preview & send"}
            description="Review the saved version of your quotation."
            icon={bookingStepIcons[step]}
          />
          {!q ? (
            <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">
              No quotation has been created. Choose Edit booking to prepare one.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm">
                  Revision{" "}
                  <select
                    className="ml-2 rounded-lg border p-2"
                    value={q.id}
                    onChange={(e) => setRevisionId(Number(e.target.value))}
                  >
                    {quotes.map((quote) => (
                      <option key={quote.id} value={quote.id}>
                        Revision {quote.revision} · {quote.status}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="outline" disabled={busy} onClick={() => download(q.id)}>
                  Download PDF
                </Button>
              </div>
              <QuotationPreview quotation={q} />
              {step === 3 && (
                <div className="rounded-xl border bg-white p-5 space-y-3">
                  <p className="text-sm">
                    Recipient: <strong>{q.snapshot.customerEmail || "Missing email"}</strong>
                  </p>
                  <Button
                    disabled={
                      busy ||
                      !emailConfigured ||
                      !q.snapshot.customerEmail ||
                      q.id !== quotes[0]?.id ||
                      q.status !== "DRAFT" ||
                      ["CANCELLED", "SUPERSEDED"].includes(b.status)
                    }
                    onClick={() => send(q.id)}
                  >
                    Send quotation
                  </Button>
                  {!emailConfigured && (
                    <p className="text-sm text-amber-800">
                      Configure the company email sender before sending.
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    Previous revisions retain their original prices and terms.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Step 4: Customer response & email history */}
      {step === 4 && (
        <div className="space-y-5">
          <section className="rounded-2xl border bg-white p-6 space-y-4">
            <BookingSectionTitle
              title="Customer response & email history"
              description="Track each stage of your customer’s journey."
              icon={bookingStepIcons[4]}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <WorkflowStatus
                label="Email delivery"
                value={quotes[0]?.deliveries?.[0]?.status || "NOT_SENT"}
              />
              <WorkflowStatus
                label="Customer decision"
                value={quotes[0]?.status || "NOT_CREATED"}
              />
              <WorkflowStatus label="Dispatch" value={b.dispatchStatus || "NOT_READY"} />
            </div>
            {!quotes.length && (
              <p className="text-sm text-slate-500">No quotation or customer response yet.</p>
            )}
            {quotes.map((quote) => (
              <div key={quote.id} className="border-t pt-4 space-y-2">
                <h3 className="font-semibold">
                  Revision {quote.revision} · {quote.status}
                </h3>
                {quote.respondedAt && (
                  <p className="text-sm">
                    {quote.respondentName} · {date(quote.respondedAt)}
                    {quote.responseReason && ` · ${quote.responseReason}`}
                  </p>
                )}
                {quote.deliveries?.map((d: QuotationDelivery) => (
                  <div key={d.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <p>
                      {d.recipient} · {d.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      {d.kind} · {date(d.createdAt)}
                    </p>
                    {d.lastError && <p className="text-red-700">{d.lastError}</p>}
                  </div>
                ))}
              </div>
            ))}
          </section>

          <section className="rounded-2xl border bg-white p-6 space-y-4">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="text-xl font-semibold">Dispatch jobs</h2>
              <DispatchStatusBadge status={b.dispatchStatus} />
            </div>
            <Link href="/dashboard/dispatch" className="text-sm underline">
              Open dispatch board
            </Link>
            {!b.jobs?.length && (
              <p className="text-sm text-slate-500">Jobs are created after customer acceptance.</p>
            )}
            {b.jobs?.map((j) => (
              <article key={j.id} className="rounded-lg border p-4 text-sm space-y-2">
                <Link href={"/dashboard/routing?jobId=" + j.id} className="text-blue-700 underline">
                  Plan and review coach route
                </Link>
                <p className="font-semibold">
                  Job #{j.id} · {j.status.replaceAll("_", " ")}
                </p>
                <p>
                  {j.jobStartLocation} → {j.jobEndLocation}
                </p>
                <p>
                  {date(j.jobStartDateTime)} — {date(j.jobEndDateTime)}
                </p>
                {!j.assignments?.length && <p className="text-amber-700">Unassigned</p>}
                {j.assignments?.map((a) => (
                  <p key={a.id}>
                    {[a.driver?.firstName, a.driver?.lastName].filter(Boolean).join(" ") ||
                      "No driver"}{" "}
                    · {a.vehicle?.licensePlate || "No vehicle"} · {a.status.replaceAll("_", " ")}
                  </p>
                ))}
              </article>
            ))}
          </section>

          <section className="rounded-2xl border bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold">Activity history</h2>
            {!activity.length && <p className="text-sm text-slate-500">No recorded activity.</p>}
            {activity.map((a) => (
              <p key={a.id} className="border-t py-3 text-sm">
                <span className="text-slate-500 mr-3">{date(a.timestamp)}</span>
                {a.action.replaceAll("_", " ")}
              </p>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
