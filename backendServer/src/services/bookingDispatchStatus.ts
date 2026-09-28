export function bookingDispatchStatus(booking: any): string {
  if (booking.status === "CANCELLED") return "CANCELLED";
  if (booking.status !== "CONFIRMED") return "NOT_READY";
  const jobs = (booking.jobs || []).filter((j: any) => j.status !== "CANCELLED");
  if (!jobs.length) return "UNASSIGNED";
  const required = booking.noOfVehicles || 1;
  const allocations = jobs.map((j: any) => (j.assignments || []).filter((a: any) => a.status !== "CANCELLED"));
  if (allocations.every((rows: any[]) => rows.length >= required && rows.every(a => a.status === "COMPLETED"))) return "COMPLETED";
  if (allocations.every((rows: any[]) => rows.length >= required)) return "ASSIGNED";
  if (allocations.some((rows: any[]) => rows.length > 0)) return "PARTIALLY_ASSIGNED";
  return "UNASSIGNED";
}
