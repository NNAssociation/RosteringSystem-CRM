import { z } from "zod";

// ── Recurrence Rule Schema ──────────────────────────────────

const recurrenceRuleSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]),
  days: z.array(z.number().int().min(0).max(6)).optional(), // 0=Sun..6=Sat
  startDate: z.string().min(1),
  endDate: z.string().min(1),
}).optional();

// ── Booking Schemas ──────────────────────────────────────────

export const createBookingSchema = z.object({
  customerEmail: z.string().email("Valid email is required"),
  customerName: z.string().optional(),
  customerId: z.coerce.number().int().optional(),
  subject: z.string().optional().default("Standard Booking"),
  service: z.string().optional(),
  bookingDetails: z.string().optional(),
  inquiryDetails: z.string().optional(),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropoffLocation: z.string().min(1, "Dropoff location is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  endDateTime: z.string().optional(),
  passengerCount: z.coerce.number().int().min(0).optional().default(1),
  passengers: z.coerce.number().int().min(0).optional(),
  noOfVehicles: z.coerce.number().int().min(1).optional().default(1),
  vehicles: z.coerce.number().int().min(1).optional(),
  tripCount: z.coerce.number().int().min(1).optional().default(1),
  status: z.string().optional().default("Pending"),
  amount: z.number().optional(),

  // NEW: Booking type
  bookingType: z.enum(["one_way", "round_trip", "repeatable"]).optional().default("one_way"),

  // NEW: Structured location data
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  pickupPlaceId: z.string().optional(),
  dropoffLat: z.number().optional(),
  dropoffLng: z.number().optional(),
  dropoffPlaceId: z.string().optional(),

  // NEW: Round trip
  returnDate: z.string().optional(),
  returnTime: z.string().optional(),
  waitingDuration: z.coerce.number().int().min(0).optional(),

  // NEW: Repeatable
  recurrenceRule: recurrenceRuleSchema,
});

export const updateBookingSchema = z.object({
  status: z.string().optional(),
  service: z.string().optional(),
  subject: z.string().optional(),
  bookingDetails: z.string().optional(),
  inquiryDetails: z.string().optional(),
  pickupLocation: z.string().optional(),
  dropoffLocation: z.string().optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  endDateTime: z.string().optional(),
  passengerCount: z.coerce.number().int().min(0).optional(),
  passengers: z.coerce.number().int().min(0).optional(),
  noOfVehicles: z.coerce.number().int().min(1).optional(),
  vehicles: z.coerce.number().int().min(1).optional(),
  tripCount: z.coerce.number().int().min(1).optional(),
  amount: z.number().optional(),

  // NEW fields
  bookingType: z.enum(["one_way", "round_trip", "repeatable"]).optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  pickupPlaceId: z.string().optional(),
  dropoffLat: z.number().optional(),
  dropoffLng: z.number().optional(),
  dropoffPlaceId: z.string().optional(),
  returnDate: z.string().optional(),
  returnTime: z.string().optional(),
  waitingDuration: z.coerce.number().int().min(0).optional(),
  recurrenceRule: recurrenceRuleSchema,
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
