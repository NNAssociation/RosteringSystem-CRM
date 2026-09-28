import { prisma } from "../db.js";
import { businessTimeZone, dayWindow, localDate, addDateDays } from "./businessTime.js";
import { WorkflowError } from "./workflowError.js";
import { bookingDispatchStatus } from "./bookingDispatchStatus.js";
export function summarizeOperations({ jobs, employees, customers, vehicles, quotations }: any, date: string, zone: string, now = new Date()) {
  const { start, end } = dayWindow(date, zone);
  const schedule = jobs.filter((j: any) => j.booking?.status === "CONFIRMED" && j.status !== "CANCELLED" && new Date(j.jobStartDateTime) < end && new Date(j.jobEndDateTime) > start).map((j: any) => {
    const assignments = j.assignments.filter((a: any) => a.status !== "CANCELLED");
    return { id: j.id, bookingId: j.bookingId, customer: j.booking.customer?.name || j.booking.customer?.email || "Customer", start: j.jobStartDateTime, end: j.jobEndDateTime, pickup: j.jobStartLocation, destination: j.jobEndLocation,
      status: bookingDispatchStatus({ ...j.booking, jobs: [{ ...j, assignments }] }),
      required: j.booking.noOfVehicles || 1, assigned: assignments.length, needsAllocation: j.status !== "COMPLETED" && assignments.length < (j.booking.noOfVehicles || 1),
      assignments: assignments.map((a: any) => ({ id: a.id, vehicleId: a.vehicleId, driver: [a.driver?.firstName, a.driver?.lastName].filter(Boolean).join(" ") || "No driver", vehicle: a.vehicle?.licensePlate || "No vehicle", status: a.status })),
    };
  }).sort((a: any, b: any) => +new Date(a.start) - +new Date(b.start) || a.id - b.id);
  const attention: any[] = [];
  for (const j of schedule) if (j.needsAllocation) attention.push({ key: `job-${j.id}`, kind: "allocation", title: `Job #${j.id} needs ${j.required - j.assigned} allocation(s)`, detail: j.customer, href: `/dashboard/dispatch?date=${date}`, tone: "amber" });
  // Follow-ups and licence alerts describe current risk, independently of the schedule date.
  const today = localDate(now, zone), expiryLimit = addDateDays(today, 30);
  for (const e of employees) if (e.status === "ACTIVE" && e.role === "DRIVER" && e.profile?.driverLicenseExpiry) {
    const expiry = localDate(e.profile.driverLicenseExpiry, zone);
    if (expiry <= expiryLimit) attention.push({ key: `licence-${e.id}`, kind: "licence", title: `${e.firstName || ""} ${e.lastName || ""}: licence ${expiry < today ? "expired" : "expires soon"}`, detail: expiry, href: `/dashboard/employees?record=${e.id}`, tone: expiry < today ? "rose" : "amber" });
  }
  for (const q of quotations) {
    if (["CANCELLED", "SUPERSEDED"].includes(q.booking?.status)) continue;
    const delivery = q.deliveries?.[0];
    if (q.status === "SENT" && +new Date(q.expiresAt) > +now && +new Date(q.expiresAt) <= +now + 48 * 3600000) attention.push({ key: `quote-${q.id}`, kind: "quotation", title: `Quotation #${q.id} expires within 48 hours`, detail: q.snapshot?.customerName || `Booking #${q.bookingId}`, href: `/dashboard/bookings/${q.bookingId}`, tone: "amber" });
    if (delivery && ["FAILED", "BOUNCED", "BLOCKED", "UNKNOWN"].includes(delivery.status) && ["SENT", "ACCEPTED", "DECLINED"].includes(q.status)) attention.push({ key: `delivery-${delivery.id}`, kind: "delivery", title: `Quotation #${q.id}: ${delivery.status.toLowerCase()} email`, detail: delivery.recipient, href: `/dashboard/bookings/${q.bookingId}`, tone: "rose" });
  }
  const canonical = (v: any) => String(v.status || "").toUpperCase().replaceAll(" ", "_");
  return { date, timeZone: zone, generatedAt: now.toISOString(), metrics: { confirmedTripLegs: schedule.length, jobsNeedingAllocation: schedule.filter((j: any) => j.needsAllocation).length, activeEmployees: employees.filter((e: any) => e.status === "ACTIVE").length, activeCustomers: customers.filter((c: any) => c.isActive).length }, schedule, attention,
    fleet: { eligibleActive: vehicles.filter((v: any) => ["ACTIVE", "AVAILABLE"].includes(canonical(v)) && (!v.availableFrom || new Date(v.availableFrom) <= start) && (!v.availableTo || new Date(v.availableTo) >= end)).length, scheduled: new Set(schedule.flatMap((j: any) => j.assignments.map((a: any) => a.vehicleId).filter(Boolean))).size, maintenance: vehicles.filter((v: any) => canonical(v) === "MAINTENANCE").length, inactive: vehicles.filter((v: any) => canonical(v) === "INACTIVE").length, total: vehicles.length } };
}
export async function dashboardOverview(date = localDate(new Date()), db: any = prisma) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new WorkflowError("Date must be YYYY-MM-DD");
  const zone = businessTimeZone(), { start, end } = dayWindow(date, zone);
  return db.$transaction(async (tx: any) => {
    const [jobs, employees, customers, vehicles, quotations] = await Promise.all([
      tx.job.findMany({ where: { booking: { status: "CONFIRMED" }, status: { not: "CANCELLED" }, jobStartDateTime: { lt: end }, jobEndDateTime: { gt: start } }, include: { booking: { include: { customer: { select: { name: true, email: true } } } }, assignments: { include: { driver: { select: { firstName: true, lastName: true } }, vehicle: { select: { licensePlate: true } } } } } }),
      tx.user.findMany({ select: { id: true, firstName: true, lastName: true, status: true, role: true, profile: { select: { driverLicenseExpiry: true } } } }),
      tx.customer.findMany({ select: { isActive: true } }), tx.fleetVehicle.findMany({ select: { id: true, status: true, availableFrom: true, availableTo: true } }),
      tx.quotation.findMany({ where: { status: { in: ["SENT", "ACCEPTED", "DECLINED"] } }, include: { booking: { select: { status: true } }, deliveries: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    ]);
    return summarizeOperations({ jobs, employees, customers, vehicles, quotations }, date, zone);
  }, { isolationLevel: "RepeatableRead", timeout: 15000 });
}
