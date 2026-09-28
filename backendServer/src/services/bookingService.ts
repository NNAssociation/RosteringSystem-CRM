import { prisma } from "../db.js";
import { bookingDispatchStatus } from "./bookingDispatchStatus.js";
import { bookingData } from "./bookingWorkflow.js";
import { localDate } from "./businessTime.js";
import { WorkflowError } from "./workflowError.js";
import { cancelBookingAssignments } from "./assignmentService.js";
import type { CreateBookingInput, UpdateBookingInput } from "../validators/bookingSchema.js";
export { WorkflowError as ValidationError } from "./workflowError.js";

const include = { customer: true, jobs: { include: { assignments: { where: { status: { not: "CANCELLED" } }, include: { driver: { select: { id: true, firstName: true, lastName: true } }, vehicle: { select: { id: true, licensePlate: true } } } } } }, quotations: { orderBy: { revision: "desc" }, include: { deliveries: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] } } } };
function response(b: any) {
  const q = b.quotations?.[0];
  return {
    ...b, quotations: undefined, customerName: b.customer?.name || b.customer?.email || "Customer", customerEmail: b.customer?.email,
    customerId: b.customerId, pickupLocation: b.startLocation, dropoffLocation: b.endLocation,
    date: localDate(b.startDateTime, b.timeZone), startTime: b.startDateTime,
    endDate: b.endDateTime ? localDate(b.endDateTime, b.timeZone) : null, endTime: b.endDateTime,
    returnDate: b.returnDateTime ? localDate(b.returnDateTime, b.timeZone) : null, returnTime: b.returnDateTime,
    bookingDetails: b.inquiryDetails || "", quotationId: q?.id,
    quotationStatus: q?.status === "SENT" && q.expiresAt < new Date() ? "EXPIRED" : q?.status || "NOT_CREATED",
    emailStatus: q?.deliveries?.[0]?.status || null,
    dispatchStatus: bookingDispatchStatus(b),
  };
}
export async function getAllBookings() { return (await prisma.booking.findMany({ include, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })).map(response); }
export async function getBookingById(id: number, db: any = prisma) { const b = await db.booking.findUnique({ where: { id }, include }); return b ? response(b) : null; }
export async function createBooking(input: CreateBookingInput, meta?: { userId?: number | undefined }, db: any = prisma) {
  const b = await db.$transaction(async (tx: any) => {
    let customer = input.customerId ? await tx.customer.findUnique({ where: { id: input.customerId } }) : await tx.customer.findUnique({ where: { email: input.customerEmail } });
    if (!customer) customer = await tx.customer.create({ data: { email: input.customerEmail, name: input.customerName || "Customer" } });
    return tx.booking.create({ data: { ...bookingData(input), status: "DRAFT", customerId: customer.id }, include });
  });
  return response(b);
}
export async function updateBooking(id: number, input: UpdateBookingInput, meta?: { userId?: number | undefined }, db: any = prisma) {
  return db.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
    const b = await tx.booking.findUnique({ where: { id }, include: { quotations: true } });
    if (!b) throw new WorkflowError("Booking not found", 404);
    if (b.status === "CONFIRMED") throw new WorkflowError("Create an amendment to change an accepted booking", 409);
    if (["CANCELLED", "SUPERSEDED"].includes(b.status)) throw new WorkflowError("Cancelled or replaced bookings cannot be edited", 409);
    if (input.status && !["DRAFT", "Pending"].includes(input.status)) throw new WorkflowError("Booking confirmation requires customer acceptance", 409);
    if ((input as any).revision !== undefined && (input as any).revision !== b.revision) throw new WorkflowError("Booking changed. Reload before editing.", 409);
    await tx.quotation.updateMany({ where: { bookingId: id, status: { in: ["DRAFT", "SENT"] } }, data: { status: "SUPERSEDED", tokenHash: null, tokenCipher: null } });
    await tx.emailDelivery.updateMany({ where: { quotation: { bookingId: id }, status: "QUEUED" }, data: { status: "CANCELLED" } });
    return response(await tx.booking.update({ where: { id }, data: { ...bookingData(input, b), status: "DRAFT", revision: { increment: 1 } }, include }));
  });
}
export async function cancelBooking(id: number, meta?: { userId?: number | undefined }) {
  await prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
    if (await tx.assignment.count({ where: { job: { bookingId: id }, status: { in: ["IN_PROGRESS", "COMPLETED"] } } })) throw new WorkflowError("A started trip cannot be cancelled here", 409);
    await tx.booking.update({ where: { id }, data: { status: "CANCELLED" } });
    await tx.quotation.updateMany({ where: { bookingId: id, status: { in: ["DRAFT", "SENT"] } }, data: { status: "WITHDRAWN", tokenHash: null, tokenCipher: null } });
    await tx.emailDelivery.updateMany({ where: { quotation: { bookingId: id }, status: "QUEUED" }, data: { status: "CANCELLED" } });
    await cancelBookingAssignments(tx, id);
    await tx.job.updateMany({ where: { bookingId: id }, data: { status: "CANCELLED" } });
    await tx.workflowEvent.create({ data: { type: "job.updated", payload: { bookingId: id } } });
  }, { maxWait: 15000, timeout: 60000 });
  return { success: true, id };
}
