import { formatInTimeZone } from "date-fns-tz";
import type { Prisma } from "../../generated/prisma/index.js";
import { bookingItineraries, normalizePoints, routeFingerprint } from "./bookingRoute.js";
import { addDateDays, businessTimeZone, dateTime, localDate, validZone } from "./businessTime.js";
import { WorkflowError } from "./workflowError.js";

export function bookingData(input: any, existing?: any) {
  const zone = validZone(input.timeZone || existing?.timeZone || businessTimeZone());
  const parse = (day: string, time: string) =>
    time?.includes("T") ? new Date(time) : dateTime(day, time || "09:00", zone);
  const start = input.date
    ? parse(
        input.date,
        input.startTime ||
          (existing ? formatInTimeZone(existing.startDateTime, zone, "HH:mm") : "09:00"),
      )
    : existing?.startDateTime;
  if (!start || !Number.isFinite(new Date(start).getTime()))
    throw new WorkflowError("Trip date is required");
  const end = input.endTime
    ? parse(input.endDate || input.date || localDate(start, zone), input.endTime)
    : input.endDateTime
      ? new Date(input.endDateTime)
      : existing?.endDateTime || new Date(new Date(start).getTime() + 2 * 3600000);
  if (!Number.isFinite(end.getTime()) || end <= start)
    throw new WorkflowError("Trip end must be after its start");
  const type = input.bookingType || existing?.bookingType || "one_way";
  const returnDateTime =
    type === "round_trip"
      ? input.returnTime
        ? parse(input.returnDate || input.date || localDate(start, zone), input.returnTime)
        : existing?.returnDateTime || new Date(end.getTime() + (input.waitingDuration || 0) * 60000)
      : null;
  if (returnDateTime && returnDateTime < end)
    throw new WorkflowError("Return departure must follow the outbound trip");
  const returnEndDateTime =
    type === "round_trip"
      ? input.returnEndTime
        ? parse(
            input.returnEndDate ||
              input.returnDate ||
              input.date ||
              localDate(returnDateTime!, zone),
            input.returnEndTime,
          )
        : input.returnEndDateTime
          ? new Date(input.returnEndDateTime)
          : existing?.returnEndDateTime || null
      : null;
  if (
    returnEndDateTime &&
    (!Number.isFinite(new Date(returnEndDateTime).getTime()) ||
      returnEndDateTime <= returnDateTime!)
  )
    throw new WorkflowError("Return arrival must follow return departure");

  const legacy = bookingItineraries({ ...existing, bookingType: type });
  const endpoint = (prefix: "pickup" | "dropoff", old: any) => {
    const coordinateChanged = ["Lat", "Lng"].some(
      (suffix) =>
        input[prefix + suffix] !== undefined &&
        input[prefix + suffix] !== existing?.[prefix + suffix],
    );
    return {
      ...old,
      address: input[prefix + "Location"] ?? old.address,
      lat: input[prefix + "Lat"] !== undefined ? (input[prefix + "Lat"] ?? undefined) : old.lat,
      lng: input[prefix + "Lng"] !== undefined ? (input[prefix + "Lng"] ?? undefined) : old.lng,
      placeId:
        input[prefix + "PlaceId"] !== undefined
          ? (input[prefix + "PlaceId"] ?? undefined)
          : old.placeId,
      ...(coordinateChanged ? { entrance: undefined } : {}),
    };
  };
  let candidate = normalizePoints(
    [
      endpoint("pickup", legacy.outboundItinerary[0]),
      ...(input.stops !== undefined && !existing?.outboundItinerary
        ? input.stops
        : legacy.outboundItinerary.slice(1, -1)),
      endpoint("dropoff", legacy.outboundItinerary.at(-1)),
    ],
    "outbound",
  );
  if (
    !existing?.outboundItinerary &&
    input.stops?.length >= 2 &&
    input.stops[0]?.address === candidate[0]?.address &&
    input.stops.at(-1)?.address === candidate.at(-1)?.address
  )
    candidate = normalizePoints(input.stops, "outbound");
  const routeChanged =
    routeFingerprint({ outboundItinerary: candidate }) !==
      routeFingerprint({ outboundItinerary: legacy.outboundItinerary }) ||
    (input.returnItinerary?.length >= 2 &&
      routeFingerprint({ outboundItinerary: input.returnItinerary }) !==
        routeFingerprint({ outboundItinerary: legacy.returnItinerary || [] })) ||
    (input.bookingType !== undefined && input.bookingType !== existing?.bookingType);
  const outbound = input.outboundItinerary
    ? normalizePoints(input.outboundItinerary, "outbound")
    : existing?.outboundItinerary || (existing && routeChanged)
      ? candidate
      : undefined;
  let returnPoints =
    input.returnItinerary?.length >= 2
      ? normalizePoints(input.returnItinerary, "return")
      : existing?.returnItinerary?.length >= 2
        ? existing.returnItinerary
        : type === "round_trip" && outbound
          ? normalizePoints(
              [...outbound].reverse().map((p: any) => ({ ...p, id: undefined })),
              "return",
            )
          : undefined;
  const first = outbound?.[0],
    last = outbound?.[outbound.length - 1];
  if (returnPoints?.length >= 2 && first && last)
    returnPoints = returnPoints.map((p: any, i: number) => {
      const endpoint = i === 0 ? last : i === returnPoints.length - 1 ? first : null;
      return endpoint
        ? {
            ...p,
            kind: "STOP",
            address: endpoint.address,
            lat: endpoint.lat,
            lng: endpoint.lng,
            placeId: endpoint.placeId,
            ...(p.lat !== endpoint.lat || p.lng !== endpoint.lng ? { entrance: undefined } : {}),
          }
        : p;
    });
  return {
    ...(outbound ? { outboundItinerary: outbound } : {}),
    ...(returnPoints ? { returnItinerary: returnPoints } : {}),
    returnItineraryConfirmed:
      input.returnItineraryConfirmed ?? existing?.returnItineraryConfirmed ?? false,
    subject: input.subject || input.service || existing?.subject || "Trip booking",
    inquiryDetails: input.bookingDetails ?? input.inquiryDetails ?? existing?.inquiryDetails ?? "",
    startDateTime: start,
    endDateTime: end,
    returnDateTime,
    returnEndDateTime,
    timeZone: zone,
    startLocation: first?.address || (input.pickupLocation ?? existing?.startLocation ?? "TBD"),
    endLocation: last?.address || (input.dropoffLocation ?? existing?.endLocation ?? "TBD"),
    noOfVehicles: input.noOfVehicles ?? input.vehicles ?? existing?.noOfVehicles ?? 1,
    passengerCount: input.passengerCount ?? input.passengers ?? existing?.passengerCount ?? 1,
    tripCount: input.tripCount ?? existing?.tripCount ?? 1,
    bookingType: type,
    waitingDuration: input.waitingDuration ?? existing?.waitingDuration ?? 0,
    recurrenceRule:
      type === "repeatable"
        ? (input.recurrenceRule ?? existing?.recurrenceRule ?? undefined)
        : undefined,
    stops: outbound
      ? outbound.slice(1, -1).filter((p: any) => p.kind !== "VIA")
      : (input.stops ?? existing?.stops ?? []),
    pickupLat: first
      ? (first.lat ?? null)
      : input.pickupLat !== undefined
        ? input.pickupLat
        : (existing?.pickupLat ?? null),
    pickupLng: first
      ? (first.lng ?? null)
      : input.pickupLng !== undefined
        ? input.pickupLng
        : (existing?.pickupLng ?? null),
    pickupPlaceId: first
      ? (first.placeId ?? null)
      : input.pickupPlaceId !== undefined
        ? input.pickupPlaceId
        : (existing?.pickupPlaceId ?? null),
    dropoffLat: last
      ? (last.lat ?? null)
      : input.dropoffLat !== undefined
        ? input.dropoffLat
        : (existing?.dropoffLat ?? null),
    dropoffLng: last
      ? (last.lng ?? null)
      : input.dropoffLng !== undefined
        ? input.dropoffLng
        : (existing?.dropoffLng ?? null),
    dropoffPlaceId: last
      ? (last.placeId ?? null)
      : input.dropoffPlaceId !== undefined
        ? input.dropoffPlaceId
        : (existing?.dropoffPlaceId ?? null),
  };
}

export function buildJobs(booking: any) {
  const start = new Date(booking.startDateTime),
    end = new Date(booking.endDateTime);
  const duration = end.getTime() - start.getTime();
  if (!(duration > 0)) throw new WorkflowError("Trip duration must be positive");
  if ([booking.startLocation, booking.endLocation].some((v) => !v || v === "TBD"))
    throw new WorkflowError("Complete pickup and destination before sending a quotation");

  const starts: Date[] = [];
  if (booking.bookingType === "repeatable") {
    const rule = booking.recurrenceRule;
    if (!rule?.startDate || !rule?.endDate || rule.endDate < rule.startDate)
      throw new WorkflowError("Complete the recurrence dates");
    if (rule.type === "weekly" && !rule.days?.length)
      throw new WorkflowError("Select at least one recurrence weekday");
    const days = (Date.parse(rule.endDate) - Date.parse(rule.startDate)) / 86400000;
    if (!Number.isFinite(days) || days > 366)
      throw new WorkflowError("Recurring quotations support up to one year");
    for (let day = rule.startDate; day <= rule.endDate; day = addDateDays(day, 1)) {
      const weekday = new Date(`${day}T12:00Z`).getUTCDay();
      if (rule.type === "weekly" && !rule.days.includes(weekday)) continue;
      if (rule.type === "monthly" && day.slice(8) !== rule.startDate.slice(8)) continue;
      starts.push(
        dateTime(day, formatInTimeZone(start, booking.timeZone, "HH:mm"), booking.timeZone),
      );
    }
  } else {
    starts.push(start);
  }

  const jobs = starts.map(
    (s) =>
      ({
        itinerary: bookingItineraries(booking).outboundItinerary,
        direction: "OUTBOUND",
        bookingId: booking.id,
        jobStartLocation: booking.startLocation,
        jobEndLocation: booking.endLocation,
        jobStartLat: booking.pickupLat,
        jobStartLng: booking.pickupLng,
        jobEndLat: booking.dropoffLat,
        jobEndLng: booking.dropoffLng,
        jobStartDateTime: s,
        jobEndDateTime: new Date(s.getTime() + duration),
        durationHours: duration / 3600000,
        status: "UNASSIGNED",
        jobCategory: booking.subject,
      }) satisfies Prisma.JobCreateManyInput,
  );

  if (booking.bookingType === "round_trip") {
    const ret = new Date(booking.returnDateTime);
    if (!Number.isFinite(ret.getTime()) || ret < end)
      throw new WorkflowError("Invalid return departure");
    const returnEnd = booking.returnEndDateTime
      ? new Date(booking.returnEndDateTime)
      : new Date(ret.getTime() + duration);
    if (!(returnEnd > ret)) throw new WorkflowError("Return arrival must follow return departure");
    jobs.push({
      itinerary: bookingItineraries(booking).returnItinerary || [],
      direction: "RETURN",
      bookingId: booking.id,
      jobStartLocation: booking.endLocation,
      jobEndLocation: booking.startLocation,
      jobStartLat: booking.dropoffLat,
      jobStartLng: booking.dropoffLng,
      jobEndLat: booking.pickupLat,
      jobEndLng: booking.pickupLng,
      jobStartDateTime: ret,
      jobEndDateTime: returnEnd,
      durationHours: (returnEnd.getTime() - ret.getTime()) / 3600000,
      status: "UNASSIGNED",
      jobCategory: `${booking.subject} (Return)`,
    } satisfies Prisma.JobCreateManyInput);
  }

  if (!jobs.length) throw new WorkflowError("Recurrence has no trips");
  return jobs;
}
