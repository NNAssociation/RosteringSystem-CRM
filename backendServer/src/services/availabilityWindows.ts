import { formatInTimeZone } from "date-fns-tz";
import { addDateDays, businessTimeZone, dateTime, localDate } from "./businessTime.js";

export function availabilityWindows(blocks: any[], start: Date, end: Date) {
  const windows: Array<{ start: Date; end: Date; block: any }> = [];
  for (const block of blocks) {
    if (block.dayOfWeek == null) { windows.push({ start: new Date(block.startTime), end: new Date(block.endTime), block }); continue; }
    for (let day = addDateDays(localDate(start), -1); day <= localDate(end); day = addDateDays(day, 1)) {
      if (new Date(`${day}T12:00Z`).getUTCDay() !== block.dayOfWeek) continue;
      const from = formatInTimeZone(block.startTime, businessTimeZone(), "HH:mm"), to = formatInTimeZone(block.endTime, businessTimeZone(), "HH:mm");
      windows.push({ start: dateTime(day, from), end: dateTime(to <= from ? addDateDays(day, 1) : day, to), block });
    }
  }
  return windows;
}
