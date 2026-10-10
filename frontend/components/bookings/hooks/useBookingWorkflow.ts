"use client";

import { readBookingDraft, removeBookingDraft, writeBookingDraft } from "@/lib/booking-draft";
import { tripRouteInput } from "@/lib/booking-route";
import { dateParts, useWorkflowApi } from "@/lib/workflow-api";
import type {
  ActivityEntry,
  BookingRecord,
  BookingTrip,
  QuotationConfig,
  QuotationRevision,
} from "@/types/booking-workflow";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { INITIAL_TRIP_STATE } from "../config/booking-workflow.config";

export function useBookingWorkflow(bookingId?: string) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const api = useWorkflowApi();
  const router = useRouter();

  const [trip, setTrip] = useState<BookingTrip>(INITIAL_TRIP_STATE);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [quotes, setQuotes] = useState<QuotationRevision[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [config, setConfig] = useState<QuotationConfig | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tripDirty, setTripDirty] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce ref for session storage
  const draftTimerRef = useRef<NodeJS.Timeout | null>(null);

  const locked =
    booking?.status === "CONFIRMED" ||
    booking?.status === "CANCELLED" ||
    booking?.status === "SUPERSEDED";

  const changeTrip = useCallback(<K extends keyof BookingTrip>(key: K, value: BookingTrip[K]) => {
    setTrip((t) => ({ ...t, [key]: value }));
    setTripDirty(true);
  }, []);

  const batchChangeTrip = useCallback((partial: Partial<BookingTrip>) => {
    setTrip((t) => ({ ...t, ...partial }));
    setTripDirty(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!bookingId) return null;
    const [b, qs, a] = await Promise.all([
      api(`bookings/${bookingId}`) as Promise<BookingRecord>,
      api(`quotations/booking/${bookingId}`).catch((err) => {
        console.warn("Could not load quotations for booking", err);
        return [] as QuotationRevision[];
      }),
      api(`quotations/booking/${bookingId}/activity`).catch((err) => {
        console.warn("Could not load quotation activity for booking", err);
        return [] as ActivityEntry[];
      }),
    ]);
    setBooking(b);
    setQuotes(qs || []);
    setActivity(a || []);
    return { b, qs: qs || [], a: a || [] };
  }, [api, bookingId]);

  // Initial load
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [c, result] = await Promise.all([
          api("quotations/config") as Promise<QuotationConfig>,
          bookingId ? refresh() : Promise.resolve(null),
        ]);

        if (cancelled) return;
        setConfig(c);

        if (bookingId && result) {
          const { b } = result;
          const rawStart = b.startTime || b.startDateTime || new Date().toISOString();
          const rawEnd = b.endTime || b.endDateTime || rawStart;
          const rawReturn = b.returnTime || b.returnDateTime;

          const start = dateParts(rawStart, b.timeZone);
          const end = dateParts(rawEnd, b.timeZone);
          const ret = rawReturn ? dateParts(rawReturn, b.timeZone) : null;

          setTrip({
            ...INITIAL_TRIP_STATE,
            subject: b.subject || "",
            customerName: b.customerName || b.customer?.name || "",
            customerEmail: b.customerEmail || b.customer?.email || "",
            customerId: b.customerId,
            bookingType: (b.bookingType as any) || "one_way",
            passengerCount: b.passengerCount || 1,
            noOfVehicles: b.noOfVehicles || 1,
            bookingDetails: b.bookingDetails || b.inquiryDetails || "",
            timeZone: b.timeZone || "Australia/Sydney",
            ...start,
            returnEndDate: b.returnEndDateTime
              ? dateParts(b.returnEndDateTime, b.timeZone).date
              : "",
            returnEndTime: b.returnEndDateTime
              ? dateParts(b.returnEndDateTime, b.timeZone).time
              : "",
            startTime: start.time,
            endDate: end.date,
            endTime: end.time,
            returnDate: ret?.date || "",
            returnTime: ret?.time || "14:00",
            outboundItinerary: b.outboundItinerary || undefined,
            routeCalculation: b.routeCalculation,
            estimatedDistanceKm:
              b.routeCalculation?.status === "VALID"
                ? ((b.routeCalculation.outbound?.distanceMeters || 0) +
                    (b.routeCalculation.return?.distanceMeters || 0)) /
                  1000
                : undefined,
            pickup: {
              ...b.outboundItinerary?.[0],
              address: b.pickupLocation === "TBD" ? "" : b.pickupLocation,
              lat: b.pickupLat ?? undefined,
              lng: b.pickupLng ?? undefined,
              placeId: b.pickupPlaceId ?? undefined,
            },
            dropoff: {
              ...b.outboundItinerary?.[b.outboundItinerary.length - 1],
              address: b.dropoffLocation === "TBD" ? "" : b.dropoffLocation,
              lat: b.dropoffLat ?? undefined,
              lng: b.dropoffLng ?? undefined,
              placeId: b.dropoffPlaceId ?? undefined,
            },
            stops: b.stops || [],
            returnItinerary: b.returnItinerary || [],
            returnItineraryConfirmed: b.returnItineraryConfirmed ?? false,
            recurrenceRule: b.recurrenceRule || INITIAL_TRIP_STATE.recurrenceRule,
          });
        } else if (!bookingId) {
          const stored = readBookingDraft(userId);
          if (stored) {
            try {
              setTrip({ ...INITIAL_TRIP_STATE, ...stored });
            } catch {
              setTrip({
                ...INITIAL_TRIP_STATE,
                timeZone: c.timeZone,
                date: dateParts(new Date().toISOString(), c.timeZone).date,
              });
            }
          } else {
            setTrip({
              ...INITIAL_TRIP_STATE,
              timeZone: c.timeZone,
              date: dateParts(new Date().toISOString(), c.timeZone).date,
            });
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load booking workspace data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, bookingId, refresh, reloadKey, isLoaded, isSignedIn, userId]);

  // Debounced sessionStorage sync for new bookings (Issue #7 fix)
  useEffect(() => {
    if (bookingId || loading || !userId || !isSignedIn) return;

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }

    draftTimerRef.current = setTimeout(() => {
      writeBookingDraft(userId, trip);
    }, 400);

    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
    };
  }, [trip, bookingId, loading, userId, isSignedIn]);

  // Warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (tripDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [tripDirty]);

  async function runAsync<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      return await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function saveTrip(nextStep?: number, onStepChange?: (step: number) => void) {
    if (!trip.customerEmail?.trim()) {
      throw new Error(
        "Customer email is required. Please check that a customer with an email is selected, or enter their email in Step 1.",
      );
    }
    if (!trip.date) {
      throw new Error("Departure date is required. Please select a date in Step 1.");
    }

    const effectiveSubject =
      trip.subject?.trim() ||
      (trip.customerName
        ? `Trip for ${trip.customerName}`
        : trip.pickup?.address
          ? `Trip to ${trip.dropoff?.address || "Destination"}`
          : "New Trip");

    if (!trip.subject?.trim()) {
      setTrip((t) => ({ ...t, subject: effectiveSubject }));
    }

    if (locked) {
      if (nextStep !== undefined && onStepChange) onStepChange(nextStep);
      return;
    }

    if (!tripDirty && bookingId && booking?.routeCalculation?.status !== "OUTDATED") {
      if (nextStep !== undefined && onStepChange) onStepChange(nextStep);
      return;
    }

    const body = {
      ...trip,
      stops: trip.stops,
      ...(trip.outboundItinerary ? tripRouteInput(trip) : {}),
      subject: effectiveSubject,
      revision: booking?.revision,
      pickupLocation: trip.pickup?.address || "TBD",
      dropoffLocation: trip.dropoff?.address || "TBD",
      pickupLat: trip.pickup.lat ?? null,
      pickupLng: trip.pickup.lng ?? null,
      pickupPlaceId: trip.pickup.placeId ?? null,
      dropoffLat: trip.dropoff.lat ?? null,
      dropoffLng: trip.dropoff.lng ?? null,
      dropoffPlaceId: trip.dropoff.placeId ?? null,
      endDate: trip.endDate || trip.date,
      returnDate: trip.returnDate || trip.date,
      status: "DRAFT",
    };

    const result = (await api(
      bookingId ? `bookings/${bookingId}` : "bookings",
      bookingId ? "PATCH" : "POST",
      {
        ...body,
        recurrenceRule: trip.bookingType === "repeatable" ? trip.recurrenceRule : undefined,
      },
    )) as BookingRecord;

    setBooking(result);
    setTrip((t) => ({
      ...t,
      routeCalculation: result.routeCalculation,
      estimatedDistanceKm:
        result.routeCalculation?.status === "VALID"
          ? ((result.routeCalculation.outbound?.distanceMeters || 0) +
              (result.routeCalculation.return?.distanceMeters || 0)) /
            1000
          : t.estimatedDistanceKm,
      outboundItinerary: result.outboundItinerary || t.outboundItinerary,
      returnItinerary: result.returnItinerary || t.returnItinerary,
    }));
    setTripDirty(false);
    setNotice("Draft saved.");

    const routeIncomplete = result.routeCalculation?.status === "OUTDATED";
    if (routeIncomplete)
      setNotice(
        "Draft saved. Route calculation is incomplete; complete the points or retry before preparing a quotation.",
      );
    if (!bookingId) {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      if (userId) removeBookingDraft(userId);
      const targetStep =
        routeIncomplete && nextStep !== undefined && nextStep >= 2
          ? 1
          : nextStep !== undefined
            ? nextStep
            : 1;
      router.replace(`/dashboard/bookings/${result.id}?edit=true&step=${targetStep}`);
    } else {
      await refresh();
      if (routeIncomplete && nextStep !== undefined && nextStep >= 2) {
        setError(
          result.routeCalculation?.error || "Calculate a valid route before preparing a quotation.",
        );
        return;
      }
      if (nextStep !== undefined && onStepChange) onStepChange(nextStep);
    }
  }

  return {
    isLoaded,
    isSignedIn,
    api,
    router,
    bookingId,
    trip,
    setTrip,
    changeTrip,
    batchChangeTrip,
    booking,
    setBooking,
    quotes,
    setQuotes,
    activity,
    setActivity,
    config,
    loading,
    busy,
    error,
    setError,
    notice,
    setNotice,
    tripDirty,
    setTripDirty,
    reloadKey,
    setReloadKey,
    locked,
    refresh,
    saveTrip,
    runAsync,
  };
}
