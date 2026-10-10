export type DragItem = { type: "job" | "assignment"; value: any };
export const labelWidth = 240;
export function jobOf(item: DragItem) {
  return item.type === "job" ? item.value : item.value.job;
}
export function times(item: DragItem) {
  return item.type === "job"
    ? [item.value.jobStartDateTime, item.value.jobEndDateTime]
    : [item.value.scheduledStart, item.value.scheduledEnd];
}
export function overlap(a: string, b: string, c: string, d: string) {
  return Date.parse(a) < Date.parse(d) && Date.parse(b) > Date.parse(c);
}
