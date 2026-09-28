// Older board responses do not include windowStart/windowEnd. Keep the axis
// anchored to the selected business date even while those servers are updated.
export function timelineWindow(date: string, weekly: boolean, timeZone: string, windowStart?: string, windowEnd?: string) {
  const suppliedStart = Date.parse(windowStart || ""), suppliedEnd = Date.parse(windowEnd || "");
  if (Number.isFinite(suppliedStart) && Number.isFinite(suppliedEnd) && suppliedEnd > suppliedStart) return { start: suppliedStart, end: suppliedEnd };
  const day = new Date(`${date}T00:00:00Z`);
  if (weekly) day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  const midnight = (calendar: Date) => {
    const target = calendar.getTime();
    let instant = target;
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    for (let i = 0; i < 4; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
      const wallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      const correction = target - wallTime;
      instant += correction;
      if (!correction) break;
    }
    return instant;
  };
  const start = midnight(day);
  day.setUTCDate(day.getUTCDate() + (weekly ? 7 : 1));
  return { start, end: midnight(day) };
}

export function clampTimelineZoom(value: number, minimum = 0.5, maximum = 4) { return Math.min(Math.max(maximum, minimum), Math.max(minimum, value)); }
export function anchoredTimelineScroll(scroll: number, pointer: number, labelWidth: number, previousZoom: number, nextZoom: number) {
  const offset = Math.max(0, pointer - labelWidth);
  return Math.max(0, (scroll + offset) * nextZoom / previousZoom - offset);
}

export function clipTimelineRange(from: string, to: string, start: number, width: number, pixelsPerMinute: number) {
  const left = Math.max(0, (Date.parse(from) - start) / 60000 * pixelsPerMinute);
  const right = Math.min(width, (Date.parse(to) - start) / 60000 * pixelsPerMinute);
  return { left, width: Math.max(0, right - left) };
}
export function stackTimelineJobs<T extends { jobStartDateTime: string; jobEndDateTime: string }>(jobs: T[]) {
  const lanes: number[] = [];
  return [...jobs].sort((a, b) => Date.parse(a.jobStartDateTime) - Date.parse(b.jobStartDateTime)).map(job => {
    const begins = Date.parse(job.jobStartDateTime);
    let lane = lanes.findIndex(end => end <= begins);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = Date.parse(job.jobEndDateTime);
    return { job, lane };
  });
}
