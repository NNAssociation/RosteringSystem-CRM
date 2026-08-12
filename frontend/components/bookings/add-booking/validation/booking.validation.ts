import { z } from "zod";

// ── Shared Schemas ────────────────────────────────────────

const locationSchema = z.object({
  address: z.string().min(1, "Address is required"),
  lat: z.number().optional(),
  lng: z.number().optional(),
  placeId: z.string().optional(),
});

const baseFields = {
  customerName: z.string().min(1, "Customer is required"),
  customerEmail: z.string().email("Valid email required"),
  customerId: z.union([z.number(), z.string()]).optional(),
  customerPhone: z.string().optional(),
  pickupLocation: locationSchema,
  dropLocation: locationSchema,
  pickupDate: z.string().min(1, "Pickup date is required"),
  pickupTime: z.string().min(1, "Pickup time is required"),
  paxCount: z.number().int().min(1, "At least 1 passenger required"),
  busCount: z.number().int().min(1, "At least 1 vehicle required"),
  notes: z.string().optional(),
  subject: z.string().optional(),
};

// ── One Way Schema ────────────────────────────────────────

export const oneWaySchema = z.object({
  ...baseFields,
  bookingType: z.literal("one_way"),
});

// ── Round Trip Schema ─────────────────────────────────────

export const roundTripSchema = z
  .object({
    ...baseFields,
    bookingType: z.literal("round_trip"),
    returnDate: z.string().min(1, "Return date is required"),
    returnTime: z.string().min(1, "Return time is required"),
    waitingDuration: z.number().min(0).optional(),
  })
  .refine(
    (data) => {
      const pickup = new Date(`${data.pickupDate}T${data.pickupTime}`);
      const ret = new Date(`${data.returnDate}T${data.returnTime}`);
      return ret > pickup;
    },
    { message: "Return must be after pickup", path: ["returnDate"] }
  );

// ── Repeatable Schema ─────────────────────────────────────

export const repeatableSchema = z
  .object({
    ...baseFields,
    bookingType: z.literal("repeatable"),
    repeatType: z.enum(["daily", "weekly", "monthly"], {
      message: "Repeat type is required",
    }),
    repeatDays: z.array(z.number().int().min(0).max(6)).optional(),
    repeatStartDate: z.string().min(1, "Start date is required"),
    repeatEndDate: z.string().min(1, "End date is required"),
  })
  .refine(
    (data) => new Date(data.repeatEndDate) > new Date(data.repeatStartDate),
    { message: "End date must be after start date", path: ["repeatEndDate"] }
  );

// ── Schema Selector ───────────────────────────────────────

export function getSchemaForType(type: string) {
  switch (type) {
    case "round_trip":
      return roundTripSchema;
    case "repeatable":
      return repeatableSchema;
    default:
      return oneWaySchema;
  }
}

// ── Field Error Type ──────────────────────────────────────

export type FieldErrors = Record<string, string | undefined>;
