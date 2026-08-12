import { prisma } from "../db.js";
import { eventBus } from "../events/eventBus.js";
import { EventTypes } from "../events/eventTypes.js";
import type { CreateBookingInput, UpdateBookingInput } from "../validators/bookingSchema.js";
import { getSchedulingRules } from "./settingsService.js";
import { checkDriverConflict, checkVehicleCapacity } from "./conflictService.js";
import { getTravelTime, DEPOT_LOCATION } from "./googleMapsService.js";
import { createAssignment } from "./assignmentService.js";

// ── Response Mapper ───────────────────────────────────────

function toBookingResponse(booking: any) {
  return {
    id: booking.id,
    customerName: booking.customer?.name || "Unknown",
    customerEmail: booking.customer?.email,
    customerId: booking.customerId,
    pickupLocation: booking.startLocation,
    dropoffLocation: booking.endLocation,
    passengerCount: booking.passengerCount || 0,
    noOfVehicles: booking.noOfVehicles || 0,
    tripCount: booking.tripCount || 1,
    date: booking.startDateTime.toISOString().split("T")[0],
    startTime: booking.startDateTime.toISOString(),
    endDate: booking.endDateTime ? booking.endDateTime.toISOString().split("T")[0] : null,
    endTime: booking.endDateTime ? booking.endDateTime.toISOString() : null,
    status: booking.status,
    subject: booking.subject,
    bookingDetails: booking.inquiryDetails || "",
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),

    // New fields
    bookingType: booking.bookingType || "one_way",
    pickupLat: booking.pickupLat,
    pickupLng: booking.pickupLng,
    pickupPlaceId: booking.pickupPlaceId,
    dropoffLat: booking.dropoffLat,
    dropoffLng: booking.dropoffLng,
    dropoffPlaceId: booking.dropoffPlaceId,
    returnDate: booking.returnDateTime ? booking.returnDateTime.toISOString().split("T")[0] : null,
    returnTime: booking.returnDateTime ? booking.returnDateTime.toISOString() : null,
    waitingDuration: booking.waitingDuration,
    recurrenceRule: booking.recurrenceRule,
  };
}

// ── Service Methods ───────────────────────────────────────

export async function getAllBookings() {
  const bookings = await prisma.booking.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });
  return bookings.map(toBookingResponse);
}

export async function getBookingById(id: number) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true, jobs: true },
  });
  if (!booking) return null;
  return toBookingResponse(booking);
}

export async function createBooking(input: CreateBookingInput, meta?: { userId?: number | undefined }) {
  const subject = input.service || input.subject || "Standard Booking";
  const startLocation = input.pickupLocation || "TBD";
  const endLocation = input.dropoffLocation || "TBD";

  // Parse start datetime
  let startDateTime = new Date();
  if (input.date) {
    startDateTime = input.startTime
      ? new Date(`${input.date}T${input.startTime}`)
      : new Date(input.date);
  }
  if (isNaN(startDateTime.getTime())) {
    throw new ValidationError("Invalid start date or time format");
  }

  // Parse end datetime
  let endDateTime: Date | null = null;
  const targetEndDate = input.endDate || input.date;
  if (targetEndDate && input.endTime) {
    endDateTime = new Date(`${targetEndDate}T${input.endTime}`);
  } else if (input.endDateTime) {
    endDateTime = new Date(input.endDateTime);
  }
  if (endDateTime && isNaN(endDateTime.getTime())) {
    throw new ValidationError("Invalid end date or time format");
  }

  // Parse return datetime (round trip)
  let returnDateTime: Date | null = null;
  if (input.returnDate && input.returnTime) {
    returnDateTime = new Date(`${input.returnDate}T${input.returnTime}`);
    if (isNaN(returnDateTime.getTime())) {
      throw new ValidationError("Invalid return date or time format");
    }
  }

  const durationMs = (endDateTime && startDateTime) ? endDateTime.getTime() - startDateTime.getTime() : 0;
  const durationHours = durationMs > 0 ? durationMs / (1000 * 60 * 60) : 2;

  const customerEmail = input.customerEmail;
  const passengerCount = input.passengers || input.passengerCount || 1;
  const noOfVehicles = input.vehicles || input.noOfVehicles || 1;

  // Find customer by ID or email, or create new
  let customer;
  if (input.customerId) {
    customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  }
  if (!customer) {
    customer = await prisma.customer.findUnique({ where: { email: customerEmail } });
  }
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        email: customerEmail,
        name: input.customerName || "New Customer",
        isActive: true,
      },
    });
  }

  // Determine jobs to create
  const isRoundTrip = (input.bookingType || "one_way") === "round_trip";

  let retStart = returnDateTime;
  if (isRoundTrip && !retStart) {
    const waitingMs = (input.waitingDuration || 0) * 60 * 1000;
    retStart = new Date(startDateTime.getTime() + durationMs + waitingMs);
  }

  const jobsToCreate = isRoundTrip
    ? [
        {
          jobStartLocation: startLocation,
          jobEndLocation: endLocation,
          jobStartLat: input.pickupLat,
          jobStartLng: input.pickupLng,
          jobEndLat: input.dropoffLat,
          jobEndLng: input.dropoffLng,
          jobStartDateTime: startDateTime,
          jobEndDateTime: endDateTime,
          durationHours: durationHours,
          status: "UNASSIGNED",
          jobCategory: `${subject} (Outbound)`,
        },
        {
          jobStartLocation: endLocation,
          jobEndLocation: startLocation,
          jobStartLat: input.dropoffLat,
          jobStartLng: input.dropoffLng,
          jobEndLat: input.pickupLat,
          jobEndLng: input.pickupLng,
          jobStartDateTime: retStart!,
          jobEndDateTime: new Date(retStart!.getTime() + (durationMs > 0 ? durationMs : 2 * 3600000)),
          durationHours: durationHours,
          status: "UNASSIGNED",
          jobCategory: `${subject} (Return)`,
        },
      ]
    : [
        {
          jobStartLocation: startLocation,
          jobEndLocation: endLocation,
          jobStartLat: input.pickupLat,
          jobStartLng: input.pickupLng,
          jobEndLat: input.dropoffLat,
          jobEndLng: input.dropoffLng,
          jobStartDateTime: startDateTime,
          jobEndDateTime: endDateTime,
          durationHours: durationHours,
          status: "UNASSIGNED",
          jobCategory: subject,
        },
      ];

  // Create booking with auto-generated job(s)
  const newBooking = await prisma.booking.create({
    data: {
      subject,
      inquiryDetails: input.bookingDetails || input.inquiryDetails || "No details",
      status: input.status || "Pending",
      startDateTime,
      startLocation,
      endLocation,
      endDateTime,
      passengerCount: Number(passengerCount),
      noOfVehicles: Number(noOfVehicles),
      tripCount: Number(input.tripCount || 1),
      customerId: customer.id,

      // New fields
      bookingType: input.bookingType || "one_way",
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      pickupPlaceId: input.pickupPlaceId,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      dropoffPlaceId: input.dropoffPlaceId,
      returnDateTime: retStart,
      waitingDuration: input.waitingDuration,
      recurrenceRule: input.recurrenceRule || undefined,

      jobs: {
        create: jobsToCreate,
      },
    },
    include: { customer: true, jobs: true },
  });

  // Emit event
  eventBus.publish(EventTypes.BOOKING_CREATED, { bookingId: newBooking.id }, { userId: meta?.userId });
  if (newBooking.jobs?.[0]?.id) {
    eventBus.publish(EventTypes.JOB_CREATED, { jobId: newBooking.jobs[0].id, bookingId: newBooking.id }, { userId: meta?.userId });
  }

  // After the booking is created and events are emitted, attempt auto-assignment
  try {
    if (newBooking.jobs && newBooking.jobs.length > 0) {
      await attemptAutoAssignForBooking(newBooking);
    }
  } catch (err) {
    console.warn('Auto-assignment attempt failed, booking remains unassigned:', err);
  }

  return toBookingResponse(newBooking);
}

export async function updateBooking(id: number, input: UpdateBookingInput, meta?: { userId?: number | undefined }) {
  const updateData: any = {};
  if (input.status) updateData.status = input.status;
  if (input.service || input.subject) updateData.subject = input.service || input.subject;
  if (input.pickupLocation) updateData.startLocation = input.pickupLocation;
  if (input.dropoffLocation) updateData.endLocation = input.dropoffLocation;
  if (input.passengers || input.passengerCount) updateData.passengerCount = Number(input.passengers || input.passengerCount);
  if (input.vehicles || input.noOfVehicles) updateData.noOfVehicles = Number(input.vehicles || input.noOfVehicles);
  if (input.tripCount) updateData.tripCount = Number(input.tripCount);
  if (input.inquiryDetails || input.bookingDetails) updateData.inquiryDetails = input.inquiryDetails || input.bookingDetails;
  if (input.amount) updateData.inquiryDetails = `Amount: ${input.amount}`;

  if (input.date) {
    updateData.startDateTime = new Date(input.date);
  }

  if (input.endDate && input.endTime) {
    updateData.endDateTime = new Date(`${input.endDate}T${input.endTime}`);
  } else if (input.endDateTime) {
    updateData.endDateTime = new Date(input.endDateTime);
  }

  // New fields
  if (input.bookingType) updateData.bookingType = input.bookingType;
  if (input.pickupLat !== undefined) updateData.pickupLat = input.pickupLat;
  if (input.pickupLng !== undefined) updateData.pickupLng = input.pickupLng;
  if (input.pickupPlaceId) updateData.pickupPlaceId = input.pickupPlaceId;
  if (input.dropoffLat !== undefined) updateData.dropoffLat = input.dropoffLat;
  if (input.dropoffLng !== undefined) updateData.dropoffLng = input.dropoffLng;
  if (input.dropoffPlaceId) updateData.dropoffPlaceId = input.dropoffPlaceId;
  if (input.returnDate && input.returnTime) {
    updateData.returnDateTime = new Date(`${input.returnDate}T${input.returnTime}`);
  }
  if (input.waitingDuration !== undefined) updateData.waitingDuration = input.waitingDuration;
  if (input.recurrenceRule) updateData.recurrenceRule = input.recurrenceRule;

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: updateData,
    include: { customer: true },
  });

  eventBus.publish(EventTypes.BOOKING_UPDATED, { bookingId: id }, { userId: meta?.userId });

  return toBookingResponse(updatedBooking);
}

export async function cancelBooking(id: number, meta?: { userId?: number | undefined }) {
  await prisma.booking.update({
    where: { id },
    data: { status: "Cancelled" },
  });

  eventBus.publish(EventTypes.BOOKING_CANCELLED, { bookingId: id }, { userId: meta?.userId });

  return { success: true, id };
}

// ── Custom Error ──────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Attempts auto-assignment for all jobs in a booking, honoring:
 * 1. noOfVehicles requirement (allocates up to noOfVehicles distinct driver+vehicle pairs per job)
 * 2. Round-Trip pairing: assigns the SAME driver & vehicle to both outbound and return jobs
 */
export async function attemptAutoAssignForBooking(booking: any) {
  const rules = await getSchedulingRules();
  const vehicles = await prisma.fleetVehicle.findMany({
    where: { status: "ACTIVE" },
    include: { homeDepot: true, assignedDriver: true }
  });

  // Calculate existing assignment counts for drivers on the target booking date to prioritize active drivers
  const firstJobStart = booking.jobs?.[0]?.jobStartDateTime ? new Date(booking.jobs[0].jobStartDateTime) : new Date();
  const dayStart = new Date(firstJobStart.getFullYear(), firstJobStart.getMonth(), firstJobStart.getDate(), 0, 0, 0);
  const dayEnd = new Date(firstJobStart.getFullYear(), firstJobStart.getMonth(), firstJobStart.getDate(), 23, 59, 59);

  const activeDayAssignments = await prisma.assignment.findMany({
    where: {
      scheduledStart: { gte: dayStart, lte: dayEnd },
      status: { not: "CANCELLED" }
    },
    select: { driverId: true, vehicleId: true }
  });

  const driverWorkloadMap = new Map<number, number>();
  activeDayAssignments.forEach((a: any) => {
    if (a.driverId) driverWorkloadMap.set(a.driverId, (driverWorkloadMap.get(a.driverId) || 0) + 1);
  });

  // Sort candidate vehicles/drivers: prioritize drivers already working on this date to consolidate schedules
  vehicles.sort((vA: any, vB: any) => {
    const countA = vA.assignedDriver ? (driverWorkloadMap.get(vA.assignedDriver.id) || 0) : 0;
    const countB = vB.assignedDriver ? (driverWorkloadMap.get(vB.assignedDriver.id) || 0) : 0;
    if (countA !== countB) return countB - countA;
    return vA.id - vB.id;
  });

  const targetVehiclesCount = booking.noOfVehicles || 1;
  const isRoundTrip = booking.bookingType === 'round_trip' && booking.jobs.length >= 2;

  const assignedDriverIds = new Set<number>();
  const assignedVehicleIds = new Set<number>();

  for (let vehicleSlot = 0; vehicleSlot < targetVehiclesCount; vehicleSlot++) {
    // Find a candidate vehicle + driver pair
    for (const vehicle of vehicles) {
      if (!vehicle.assignedDriver || !vehicle.assignedDriver.isActive) continue;
      if (assignedDriverIds.has(vehicle.assignedDriver.id) || assignedVehicleIds.has(vehicle.id)) continue;

      const paxCount = booking.passengerCount || 1;
      if (vehicle.maxPassengers != null && paxCount > vehicle.maxPassengers) continue;

      let validForBooking = true;
      const proposedAssignments: Array<{ jobId: number; actualStart: Date; actualEnd: Date; travelMinutes: number; travelKm: number }> = [];

      for (const job of booking.jobs) {
        if (!job.jobStartDateTime) {
          validForBooking = false;
          break;
        }

        const durationHours = job.durationHours ? Number(job.durationHours) : 2;
        const actualStart = new Date(job.jobStartDateTime);
        const actualEnd = new Date(actualStart.getTime() + durationHours * 3600000);

        const startCoords = (job.jobStartLat && job.jobStartLng)
          ? { lat: job.jobStartLat, lng: job.jobStartLng }
          : (booking.pickupLat && booking.pickupLng) ? { lat: booking.pickupLat, lng: booking.pickupLng } : null;

        let travelMinutes = 15;
        let travelKm = 5;
        if (startCoords) {
          const depotLat = vehicle.homeDepot?.lat ?? DEPOT_LOCATION.lat;
          const depotLng = vehicle.homeDepot?.lng ?? DEPOT_LOCATION.lng;
          const travel = await getTravelTime({ lat: depotLat, lng: depotLng }, startCoords);
          travelMinutes = Math.max(15, travel.durationMinutes || 15);
          travelKm = travel.distanceKm || 5;
        }

        const conflict = await checkDriverConflict(vehicle.assignedDriver.id, actualStart, actualEnd, undefined, job.id, rules);
        if (conflict.hasConflict) {
          validForBooking = false;
          break;
        }

        proposedAssignments.push({
          jobId: job.id,
          actualStart,
          actualEnd,
          travelMinutes,
          travelKm
        });
      }

      if (validForBooking && proposedAssignments.length === booking.jobs.length) {
        // Create assignments for all jobs in this booking for the same driver & vehicle
        for (const pa of proposedAssignments) {
          await createAssignment({
            jobId: pa.jobId,
            driverId: vehicle.assignedDriver.id,
            vehicleId: vehicle.id,
            scheduledStart: pa.actualStart.toISOString(),
            scheduledEnd: pa.actualEnd.toISOString(),
            travelFromLocation: "depot",
            travelToMinutes: pa.travelMinutes,
            travelToKm: pa.travelKm,
            bufferMinutes: rules.bufferMinutes,
          });
        }
        assignedDriverIds.add(vehicle.assignedDriver.id);
        assignedVehicleIds.add(vehicle.id);
        break; // move to next vehicle slot
      }
    }
  }
}
