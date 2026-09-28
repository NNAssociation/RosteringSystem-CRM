import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { WorkflowError } from "./workflowError.js";

export const businessTimeZone = () => process.env.BUSINESS_TIMEZONE || "Australia/Sydney";
export function validZone(zone: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(); return zone; }
  catch { throw new WorkflowError("Invalid business timezone"); }
}
export function localDate(date: Date | string, zone = businessTimeZone()) {
  return formatInTimeZone(date, zone, "yyyy-MM-dd");
}
export function dateTime(date: string, time: string, zone = businessTimeZone()) {
  validZone(zone);
  const wall = `${date}T${time.length === 5 ? time + ":00" : time}`;
  const instant = fromZonedTime(wall, zone);
  if (!Number.isFinite(instant.getTime()) || formatInTimeZone(instant, zone, "yyyy-MM-dd'T'HH:mm:ss") !== wall) {
    throw new WorkflowError("Invalid date/time, or time does not exist in this timezone");
  }
  return instant;
}
export function addDateDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function dayWindow(date: string, zone = businessTimeZone()) {
  return { start: dateTime(date, "00:00", zone), end: dateTime(addDateDays(date, 1), "00:00", zone) };
}
export function boardWindow(date: string, weekly = false) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const first = weekly ? addDateDays(date, -((day + 6) % 7)) : date;
  return { start: dayWindow(first).start, end: dayWindow(addDateDays(first, weekly ? 6 : 0)).end };
}
