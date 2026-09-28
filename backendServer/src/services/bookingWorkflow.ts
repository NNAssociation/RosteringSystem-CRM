import { formatInTimeZone } from "date-fns-tz";
import { businessTimeZone, validZone, dateTime, addDateDays, localDate } from "./businessTime.js";
import { WorkflowError } from "./workflowError.js";

export function bookingData(input: any, existing?: any) {
  const zone = validZone(input.timeZone || existing?.timeZone || businessTimeZone());
  const parse = (day: string, time: string) => time?.includes("T") ? new Date(time) : dateTime(day, time || "09:00", zone);
  const start = input.date ? parse(input.date, input.startTime || (existing ? formatInTimeZone(existing.startDateTime, zone, "HH:mm") : "09:00")) : existing?.startDateTime;
  if (!start || !Number.isFinite(new Date(start).getTime())) throw new WorkflowError("Trip date is required");
  const end = input.endTime ? parse(input.endDate || input.date || localDate(start, zone), input.endTime) : input.endDateTime ? new Date(input.endDateTime) : existing?.endDateTime || new Date(new Date(start).getTime() + 2 * 3600000);
  if (!Number.isFinite(end.getTime()) || end <= start) throw new WorkflowError("Trip end must be after its start");
  const type = input.bookingType || existing?.bookingType || "one_way";
  const returnDateTime = type === "round_trip" ? (input.returnTime ? parse(input.returnDate || input.date || localDate(start, zone), input.returnTime) : existing?.returnDateTime || new Date(end.getTime() + (input.waitingDuration || 0) * 60000)) : null;
  if (returnDateTime && returnDateTime < end) throw new WorkflowError("Return departure must follow the outbound trip");
  return {
    subject: input.subject || input.service || existing?.subject || "Trip booking",
    inquiryDetails: input.bookingDetails ?? input.inquiryDetails ?? existing?.inquiryDetails ?? "",
    startDateTime: start, endDateTime: end, returnDateTime, timeZone: zone,
    startLocation: input.pickupLocation ?? existing?.startLocation ?? "TBD",
    endLocation: input.dropoffLocation ?? existing?.endLocation ?? "TBD",
    noOfVehicles: input.noOfVehicles ?? input.vehicles ?? existing?.noOfVehicles ?? 1,
    passengerCount: input.passengerCount ?? input.passengers ?? existing?.passengerCount ?? 1,
    tripCount: input.tripCount ?? existing?.tripCount ?? 1,
    bookingType: type, waitingDuration: input.waitingDuration ?? existing?.waitingDuration ?? 0,
    recurrenceRule: type === "repeatable" ? input.recurrenceRule ?? existing?.recurrenceRule ?? undefined : undefined,
    stops: input.stops ?? existing?.stops ?? [],
    pickupLat: input.pickupLat !== undefined ? input.pickupLat : existing?.pickupLat ?? null, pickupLng: input.pickupLng !== undefined ? input.pickupLng : existing?.pickupLng ?? null,
    pickupPlaceId: input.pickupPlaceId !== undefined ? input.pickupPlaceId : existing?.pickupPlaceId ?? null,
    dropoffLat: input.dropoffLat !== undefined ? input.dropoffLat : existing?.dropoffLat ?? null, dropoffLng: input.dropoffLng !== undefined ? input.dropoffLng : existing?.dropoffLng ?? null,
    dropoffPlaceId: input.dropoffPlaceId !== undefined ? input.dropoffPlaceId : existing?.dropoffPlaceId ?? null,
  };
}

export function buildJobs(booking: any) {
  const start = new Date(booking.startDateTime), end = new Date(booking.endDateTime);
  const duration = end.getTime() - start.getTime();
  if (!(duration > 0)) throw new WorkflowError("Trip duration must be positive");
  if ([booking.startLocation, booking.endLocation].some(v => !v || v === "TBD")) throw new WorkflowError("Complete pickup and destination before sending a quotation");
  const starts: Date[] = [];
  if (booking.bookingType === "repeatable") {
    const rule = booking.recurrenceRule;
    if (!rule?.startDate || !rule?.endDate || rule.endDate < rule.startDate) throw new WorkflowError("Complete the recurrence dates");
    if (rule.type === "weekly" && !rule.days?.length) throw new WorkflowError("Select at least one recurrence weekday");
    const days = (Date.parse(rule.endDate) - Date.parse(rule.startDate)) / 86400000;
    if (!Number.isFinite(days) || days > 366) throw new WorkflowError("Recurring quotations support up to one year");
    for (let day = rule.startDate; day <= rule.endDate; day = addDateDays(day, 1)) {
      const weekday = new Date(`${day}T12:00Z`).getUTCDay();
      if (rule.type === "weekly" && !rule.days.includes(weekday)) continue;
      if (rule.type === "monthly" && day.slice(8) !== rule.startDate.slice(8)) continue;
      starts.push(dateTime(day, formatInTimeZone(start, booking.timeZone, "HH:mm"), booking.timeZone));
    }
  } else starts.push(start);
  const jobs = starts.map(s => ({
    bookingId: booking.id, jobStartLocation: booking.startLocation, jobEndLocation: booking.endLocation,
    jobStartLat: booking.pickupLat, jobStartLng: booking.pickupLng, jobEndLat: booking.dropoffLat, jobEndLng: booking.dropoffLng,
    jobStartDateTime: s, jobEndDateTime: new Date(s.getTime() + duration), durationHours: duration / 3600000,
    status: "UNASSIGNED", jobCategory: booking.subject,
  }));
  if (booking.bookingType === "round_trip") {
    const ret = new Date(booking.returnDateTime);
    if (!Number.isFinite(ret.getTime()) || ret < end) throw new WorkflowError("Invalid return departure");
    jobs.push({ ...jobs[0]!, jobStartLocation: booking.endLocation, jobEndLocation: booking.startLocation,
      jobStartLat: booking.dropoffLat, jobStartLng: booking.dropoffLng, jobEndLat: booking.pickupLat, jobEndLng: booking.pickupLng,
      jobStartDateTime: ret, jobEndDateTime: new Date(ret.getTime() + duration), jobCategory: `${booking.subject} (Return)` });
  }
  if (!jobs.length) throw new WorkflowError("Recurrence has no trips");
  return jobs;
}
