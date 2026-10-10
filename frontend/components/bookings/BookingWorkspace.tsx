"use client";

import { RecordLifecycleActions } from "@/components/shared/record-lifecycle-actions";
import { InactiveRecordNotice, RecordStatusBadge } from "@/components/shared/record-status";
import { Button } from "@/components/ui/button";
import { downloadPdf, workflowBase } from "@/lib/workflow-api";
import type { QuotationDelivery } from "@/types/booking-workflow";
import { AlertCircle, FileCheck2, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BookingRecordView } from "./BookingRecordView";
import { BookingOverview, BookingSectionTitle, bookingStepIcons } from "./BookingVisuals";
import { WORKSPACE_STEPS } from "./config/booking-workflow.config";
import { useBookingWorkflow } from "./hooks/useBookingWorkflow";
import { useQuotationEditor } from "./hooks/useQuotationEditor";
import { BookingStep0BasicDetails } from "./steps/BookingStep0BasicDetails";
import { BookingStep1Locations } from "./steps/BookingStep1Locations";
import { BookingStep2Quotation } from "./steps/BookingStep2Quotation";
import { BookingStep3PreviewSend } from "./steps/BookingStep3PreviewSend";
import { BookingStep4Response } from "./steps/BookingStep4Response";

export function BookingWorkspace({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParam = searchParams?.get("edit");
  const stepParam = searchParams?.get("step");

  const [editing, setEditing] = useState(editParam === "true" || !bookingId);
  const [step, setStep] = useState(
    stepParam !== null && !isNaN(Number(stepParam)) ? Number(stepParam) : 0,
  );
  const [previewId, setPreviewId] = useState<number | null>(null);

  const workflow = useBookingWorkflow(bookingId);
  const [routeReview, setRouteReview] = useState<
    import("@/types/booking-workflow").RouteReview | undefined
  >();
  const quoteEditor = useQuotationEditor(workflow.config);

  const {
    isLoaded,
    isSignedIn,
    api,
    trip,
    changeTrip,
    batchChangeTrip,
    booking,
    quotes,
    activity,
    config,
    loading,
    busy,
    error,
    setError,
    notice,
    setNotice,
    tripDirty,
    setTripDirty,
    setReloadKey,
    locked,
    refresh,
    saveTrip,
    runAsync,
  } = workflow;

  const {
    items,
    setItems,
    discount,
    tax,
    currency,
    expires,
    terms,
    message,
    quoteDirty,
    setQuoteDirty,
    addItem,
    removeItem,
    updateItem,
    setDiscount,
    setTax,
    setCurrency,
    setExpires,
    setTerms,
    setMessage,
    hydrateQuote,
    initFromConfig,
    subtotal,
    taxAmount,
    total,
  } = quoteEditor;

  const current = quotes[0];
  const preview = quotes.find((q) => q.id === previewId) || current;

  // Sync quotation editor when config loads
  useEffect(() => {
    if (config) {
      initFromConfig(config);
    }
  }, [config, initFromConfig]);

  const [loadedQuotation, setLoadedQuotation] = useState(current);
  if (current !== loadedQuotation) {
    setLoadedQuotation(current);
    if (quotes[0] && !quoteDirty) {
      hydrateQuote(quotes[0]);
      setPreviewId(quotes[0].id);
    }
  }

  // Auto-refresh on step 4 (polling for customer response / email delivery)
  useEffect(() => {
    if (!bookingId || step !== 4) return;
    const timer = setInterval(() => {
      refresh().catch(() => setError("Could not refresh status. Check your connection."));
    }, 10000);
    return () => clearInterval(timer);
  }, [bookingId, step, refresh, setError]);

  // Warn if unloading with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (tripDirty || quoteDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [tripDirty, quoteDirty]);

  const [loadedParams, setLoadedParams] = useState({ editParam, stepParam });
  if (loadedParams.editParam !== editParam || loadedParams.stepParam !== stepParam) {
    setLoadedParams({ editParam, stepParam });
    if (editParam === "true") {
      setEditing(true);
    }
    if (stepParam !== null && !isNaN(Number(stepParam))) {
      setStep(Number(stepParam));
    }
  }

  const [loadedStatus, setLoadedStatus] = useState(booking?.status);
  if (loadedStatus !== booking?.status) {
    setLoadedStatus(booking?.status);
    if (booking?.status === "DRAFT" && !locked) {
      setEditing(true);
    }
  }

  const handleSaveTrip = useCallback(
    async (nextStep?: number) => {
      await runAsync(async () => {
        await saveTrip(nextStep, (s) => {
          setEditing(true);
          setStep(s);
        });
      });
    },
    [runAsync, saveTrip],
  );

  const handleSaveQuote = useCallback(async () => {
    if (!bookingId) {
      setError("Save trip details first.");
      return;
    }
    if (tripDirty) {
      setError("Save trip changes before preparing the quotation.");
      return;
    }

    await runAsync(async () => {
      const q = await api(`quotations/booking/${bookingId}`, "POST", {
        routeReview,
        bookingRevision: booking?.revision,
        previousQuotationId: current?.id || null,
        items,
        discountMinor: discount,
        taxBasisPoints: tax,
        currency,
        expiresAt: new Date(`${expires}T12:00:00Z`).toISOString(),
        terms,
        message,
      });
      await refresh();
      hydrateQuote(q);
      setPreviewId(q.id);
      setEditing(true);
      setStep(3);
      setNotice("Quotation revision saved. Review it before sending.");
    });
  }, [
    routeReview,
    api,
    booking?.revision,
    bookingId,
    current?.id,
    discount,
    expires,
    hydrateQuote,
    items,
    message,
    refresh,
    runAsync,
    setError,
    setNotice,
    tax,
    terms,
    currency,
    tripDirty,
  ]);

  const handleDownloadPdf = useCallback(
    (id: number) => {
      void runAsync(async () => {
        const pdfData = await api(`quotations/${id}/pdf`, "GET", undefined, true);
        downloadPdf(pdfData, `quotation-${id}.pdf`);
      });
    },
    [api, runAsync],
  );

  const handleSendQuotation = useCallback(
    (id: number) => {
      void runAsync(async () => {
        await api(`quotations/${id}/send`, "POST");
        await refresh();
        setStep(4);
        setNotice("Quotation queued. Delivery status appears below.");
      });
    },
    [api, refresh, runAsync, setNotice],
  );

  const handleRetryDelivery = useCallback(
    (delivery: QuotationDelivery) => {
      void runAsync(async () => {
        if (
          delivery.status === "UNKNOWN" &&
          !window.confirm(
            "Check this delivery in Brevo logs first. Confirm only if Brevo did not send it. Queue another attempt?",
          )
        ) {
          return;
        }
        await api(`quotations/deliveries/${delivery.id}/retry`, "POST", {
          confirmedNotSent: delivery.status === "UNKNOWN",
        });
        await refresh();
      });
    },
    [api, refresh, runAsync],
  );

  const handleResendQuotationEmail = useCallback(
    (quotationId: number) => {
      void runAsync(async () => {
        await api(`quotations/${quotationId}/send`, "POST");
        await refresh();
      });
    },
    [api, refresh, runAsync],
  );

  const handleRecordAcceptance = useCallback(
    async (quotationId: number) => {
      await runAsync(async () => {
        await api(`quotations/${quotationId}/record-acceptance`, "POST", {
          name: trip.customerName || "Customer Direct Approval",
          reason: "Direct confirmation received",
        });
        await refresh();
        setStep(4);
        setNotice(
          "Quotation accepted! Executable jobs have been created and are ready for dispatch.",
        );
      });
    },
    [api, refresh, runAsync, setNotice, trip.customerName],
  );

  // Loading state
  if (!isLoaded || loading) {
    return (
      <div className="mx-auto max-w-7xl p-6 sm:p-10 space-y-6" role="status">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Loading booking workspace…</span>
        </div>
        <div className="animate-pulse space-y-6">
          <div className="h-9 bg-slate-200/80 rounded-xl w-1/4" />
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="h-80 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Not signed in
  if (isLoaded && !isSignedIn) {
    return (
      <div role="alert" className="m-6 rounded-xl border border-blue-200 bg-blue-50 p-6 space-y-3">
        <h2 className="font-semibold text-blue-900">Sign in to continue</h2>
        <p className="text-sm text-blue-800">
          You must be signed in with an authorized staff account to access the booking workspace.
        </p>
        <Button onClick={() => router.push("/sign-in")}>Sign In</Button>
      </div>
    );
  }

  // Configuration unavailable
  if (!config) {
    const isAuthError =
      error === "Sign in to continue" ||
      error.toLowerCase().includes("sign in") ||
      error.toLowerCase().includes("unauthorized") ||
      error.toLowerCase().includes("staff role");
    return (
      <div
        role="alert"
        className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-3"
      >
        <h2 className="font-semibold">
          {isAuthError ? "Sign in to continue" : "Booking service unavailable"}
        </h2>
        <p className="text-sm">{error || "Could not load quotation settings."}</p>
        {isAuthError ? (
          <div className="flex gap-2 pt-1">
            <Button onClick={() => router.push("/sign-in")}>Sign In</Button>
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
              Retry connection
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-600">
              The frontend called{" "}
              <code className="bg-amber-100 px-1 rounded">{workflowBase}/quotations/config</code>.
              Check that the backend is running, rebuilt after the latest migration, and reachable
              at this address.
            </p>
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
              Retry connection
            </Button>
          </>
        )}
      </div>
    );
  }

  // Booking not found
  if (bookingId && !booking) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-lg m-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-4"
      >
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Booking not found or inaccessible</h2>
        <p className="text-sm text-slate-600">
          {error ||
            "The booking you requested could not be retrieved. It may have been removed or you do not have permission to view it."}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard/bookings"
            className="inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition-colors"
          >
            Back to bookings
          </Link>
          <Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8 space-y-6 booking-workspace">
      {/* Workspace Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard/bookings" className="text-sm text-slate-500 hover:underline">
            ← All bookings
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {bookingId ? `Booking #${bookingId}` : "New booking"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {booking?.amendsBookingId
              ? `Amendment to booking #${booking.amendsBookingId}. The original stays active until acceptance.`
              : "Prepare the trip, send a quotation and track the customer’s response."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {booking && (
            <RecordLifecycleActions
              resource="bookings"
              id={booking.id}
              inactive={booking.status === "CANCELLED"}
              onChanged={refresh}
              onDeleted={() => router.push("/dashboard/bookings")}
            />
          )}

          {booking && <RecordStatusBadge status={booking.status} />}

          {!locked && !editing && <Button onClick={() => setEditing(true)}>Edit booking</Button>}

          {editing && bookingId && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if ((tripDirty || quoteDirty) && !window.confirm("Discard unsaved changes?")) {
                  return;
                }
                setTripDirty(false);
                setQuoteDirty(false);
                setEditing(false);
                setReloadKey((k) => k + 1);
              }}
            >
              Cancel editing
            </Button>
          )}

          {!locked && editing && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => (step === 2 ? handleSaveQuote() : handleSaveTrip())}
            >
              Save draft
            </Button>
          )}

          {booking?.status === "CONFIRMED" && (
            <Button
              onClick={() =>
                runAsync(async () => {
                  const b = await api(`quotations/booking/${bookingId}/amend`, "POST");
                  router.push(`/dashboard/bookings/${b.id}`);
                })
              }
              disabled={busy}
            >
              Create amendment
            </Button>
          )}
        </div>
      </header>

      {booking?.status === "CANCELLED" && <InactiveRecordNotice cancelled />}

      {/* Progress navigation */}
      <nav aria-label="Booking progress" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {WORKSPACE_STEPS.map((label, i) => {
          const Icon = bookingStepIcons[i];
          const isCurrent = step === i;
          return (
            <button
              key={label}
              onClick={() => {
                if (
                  !locked &&
                  i >= 2 &&
                  (tripDirty || booking?.routeCalculation?.status === "OUTDATED")
                ) {
                  setError(
                    "Save trip changes and calculate a valid route before preparing a quotation.",
                  );
                  return;
                }
                if (!locked) setEditing(true);
                setStep(i);
              }}
              disabled={!bookingId && i > 1}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-500 ${
                isCurrent
                  ? "border-blue-200 bg-blue-50 text-blue-800 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isCurrent ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[10px] font-medium uppercase tracking-wider opacity-70">
                  Step {i + 1}
                </span>
                <span className="text-xs font-semibold">{label}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* Error & Notice banners */}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <span className="font-semibold text-red-900 mr-2">Notice:</span>
            {error}
          </div>
          {step !== 0 && (!trip.customerEmail || !trip.date) && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-900 bg-white hover:bg-red-50 text-xs shrink-0"
              onClick={() => setStep(0)}
            >
              Go to Step 1: Basic details
            </Button>
          )}
        </div>
      )}

      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
          {notice}
        </p>
      )}

      {/* Main workspace layout */}
      <div className={step === 1 ? "grid gap-6" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"}>
        <section className="min-w-0">
          {bookingId && !editing && booking ? (
            <BookingRecordView
              onEdit={!locked ? () => setEditing(true) : undefined}
              booking={booking}
              quotes={quotes}
              activity={activity}
              step={step}
              busy={busy}
              emailConfigured={!!config?.emailConfigured}
              download={handleDownloadPdf}
              send={handleSendQuotation}
            />
          ) : (
            <>
              {step === 0 && (
                <BookingStep0BasicDetails
                  trip={trip}
                  bookingId={bookingId}
                  locked={locked}
                  busy={busy}
                  onChange={changeTrip}
                  onBatchChange={batchChangeTrip}
                  onSaveContinue={() => handleSaveTrip(1)}
                  setNotice={setNotice}
                />
              )}

              {step === 1 && (
                <BookingStep1Locations
                  onPreview={(calculation) =>
                    workflow.setTrip((t) => ({
                      ...t,
                      routeCalculation: calculation,
                      estimatedDistanceKm:
                        ((calculation.outbound?.distanceMeters || 0) +
                          (calculation.return?.distanceMeters || 0)) /
                        1000,
                      estimatedDurationMinutes:
                        ((calculation.outbound?.serviceSeconds || 0) +
                          (calculation.return?.serviceSeconds || 0)) /
                        60,
                    }))
                  }
                  trip={trip}
                  bookingId={bookingId}
                  locked={locked}
                  busy={busy}
                  onChange={changeTrip}
                  onBatchChange={batchChangeTrip}
                  onSaveContinue={() => handleSaveTrip(2)}
                  onBack={() => setStep(0)}
                  setNotice={setNotice}
                />
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <BookingStep2Quotation
                    routeCalculation={booking?.routeCalculation}
                    routeReview={routeReview}
                    onRouteReview={setRouteReview}
                    trip={trip}
                    currentQuotation={current}
                    items={items}
                    discount={discount}
                    tax={tax}
                    currency={currency}
                    expires={expires}
                    terms={terms}
                    message={message}
                    subtotal={subtotal}
                    taxAmount={taxAmount}
                    total={total}
                    locked={locked}
                    busy={busy}
                    onAddItem={addItem}
                    onRemoveItem={removeItem}
                    onUpdateItem={updateItem}
                    onSetItems={setItems}
                    onDiscountChange={setDiscount}
                    onTaxChange={setTax}
                    onCurrencyChange={setCurrency}
                    onExpiresChange={setExpires}
                    onTermsChange={setTerms}
                    onMessageChange={setMessage}
                    onSaveQuote={handleSaveQuote}
                  />
                </div>
              )}

              {step === 3 && preview && (
                <BookingStep3PreviewSend
                  preview={preview}
                  current={current}
                  quotes={quotes}
                  config={config}
                  busy={busy}
                  tripDirty={tripDirty}
                  quoteDirty={quoteDirty}
                  onSelectPreviewId={setPreviewId}
                  onDownloadPdf={handleDownloadPdf}
                  onSendQuotation={handleSendQuotation}
                  onRecordAcceptance={handleRecordAcceptance}
                />
              )}

              {step === 4 && current && (
                <BookingStep4Response
                  current={current}
                  booking={booking}
                  activity={activity}
                  timeZone={trip.timeZone}
                  busy={busy}
                  onRetryDelivery={handleRetryDelivery}
                  onResendQuotationEmail={handleResendQuotationEmail}
                  onRecordAcceptance={handleRecordAcceptance}
                />
              )}

              {((step === 3 && !preview) || (step === 4 && !current)) && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8">
                  <BookingSectionTitle
                    title={
                      step === 3 ? "Your preview will appear here" : "No customer response yet"
                    }
                    description="Prepare and save a quotation to continue this journey."
                    icon={step === 3 ? Send : FileCheck2}
                  />
                  <Button variant="outline" className="mt-5" onClick={() => setStep(2)}>
                    Go to quotation
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Sidebar Summary */}
        <BookingOverview
          trip={trip}
          booking={booking}
          total={total}
          currency={currency}
          hasQuotation={!!current}
          dirty={tripDirty || quoteDirty}
        />
      </div>
    </div>
  );
}
