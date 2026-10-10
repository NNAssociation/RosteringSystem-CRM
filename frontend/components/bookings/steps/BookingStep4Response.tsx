"use client";

import { Button } from "@/components/ui/button";
import { formatTripDate } from "@/lib/workflow-api";
import type {
  ActivityEntry,
  BookingRecord,
  QuotationDelivery,
  QuotationRevision,
} from "@/types/booking-workflow";
import { FileCheck2 } from "lucide-react";
import Link from "next/link";
import { BookingSectionTitle, WorkflowStatus } from "../BookingVisuals";

interface Step4Props {
  current: QuotationRevision;
  booking: BookingRecord | null;
  activity: ActivityEntry[];
  timeZone: string;
  busy: boolean;
  onRetryDelivery: (delivery: QuotationDelivery) => void;
  onResendQuotationEmail: (quotationId: number) => void;
  onRecordAcceptance?: (id: number) => void;
}

export function BookingStep4Response({
  current,
  booking,
  activity,
  timeZone,
  busy,
  onRetryDelivery,
  onResendQuotationEmail,
  onRecordAcceptance,
}: Step4Props) {
  return (
    <div className="rounded-2xl border bg-white p-6 space-y-6">
      <BookingSectionTitle
        title="Customer response & delivery"
        description="Follow delivery, the customer’s decision and dispatch readiness."
        icon={FileCheck2}
      />

      <div className="grid sm:grid-cols-3 gap-3">
        <WorkflowStatus
          label="Email delivery"
          value={current.deliveries?.[0]?.status || "NOT_SENT"}
        />
        <WorkflowStatus label="Quotation" value={current.status} />
        <WorkflowStatus label="Dispatch" value={booking?.dispatchStatus || "NOT_READY"} />
      </div>

      {current.respondedAt && (
        <p className="text-sm font-medium text-slate-700">
          {current.respondentName} {current.status.toLowerCase()} on{" "}
          {formatTripDate(current.respondedAt, timeZone)}
          {current.responseReason ? ` — ${current.responseReason}` : ""}
        </p>
      )}

      {current.status !== "ACCEPTED" && onRecordAcceptance && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Manual Customer Approval
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              If the customer confirmed by phone or email, record acceptance here to generate
              executable dispatch jobs immediately.
            </p>
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={() => onRecordAcceptance(current.id)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
          >
            Record Customer Acceptance
          </Button>
        </div>
      )}

      {booking?.status === "CONFIRMED" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2.5">
          <div>
            <span className="text-sm font-bold text-emerald-900 block">
              ✅ Booking Confirmed & Dispatch Jobs Created
            </span>
            <p className="text-xs text-emerald-800 mt-0.5">
              The run is ready. Assign a driver in advance on Dispatch Board, then allocate a depot
              bus on morning of service.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors shadow-2xs"
              href="/dashboard/dispatch"
            >
              Open Dispatch Board →
            </Link>
            <Link
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold hover:bg-emerald-100/70 transition-colors shadow-2xs"
              href="/dashboard/yard"
            >
              Morning Yard Board →
            </Link>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="font-semibold text-slate-900">Email history</h3>
        {!current.deliveries?.length ? (
          <p className="text-sm text-slate-500">Quotation has not been sent.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {current.deliveries.map((d) => (
              <div className="py-3 text-sm" key={d.id}>
                <div className="flex justify-between gap-3 font-medium">
                  <span>
                    {d.kind === "RESPONSE" ? "Response confirmation" : "Quotation"} to {d.recipient}
                  </span>
                  <strong>{d.status}</strong>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {formatTripDate(d.createdAt, timeZone)}
                </p>
                {d.lastError && (
                  <p className="text-red-700 text-xs mt-1 bg-red-50 p-2 rounded">{d.lastError}</p>
                )}
                {["UNKNOWN", "FAILED", "BOUNCED", "BLOCKED"].includes(d.status) &&
                  (d.kind === "RESPONSE" || current.status === "SENT") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={busy}
                      onClick={() => onRetryDelivery(d)}
                    >
                      {d.status === "UNKNOWN" ? "Reconcile & retry" : "Retry email"}
                    </Button>
                  )}
              </div>
            ))}
          </div>
        )}
      </section>

      {["FAILED", "BOUNCED", "BLOCKED"].includes(current.deliveries?.[0]?.status || "") &&
        current.status === "SENT" && (
          <div>
            <Button disabled={busy} onClick={() => onResendQuotationEmail(current.id)}>
              Retry quotation email
            </Button>
          </div>
        )}

      <section className="space-y-3">
        <h3 className="font-semibold text-slate-900">Activity</h3>
        {!activity.length ? (
          <p className="text-sm text-slate-500">No recorded activity.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {activity.map((a) => (
              <p key={a.id} className="py-3 text-sm">
                <span className="text-slate-500 mr-3">{formatTripDate(a.timestamp, timeZone)}</span>
                {a.action.replaceAll("_", " ")}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
