import { z } from "zod";

const amount = z.number().finite().nonnegative();
const distanceBand = z.object({
  maxKm: z.number().finite().positive(),
  label: z.string(),
  ratePerKm: amount,
});
const distanceBands = z
  .array(distanceBand)
  .min(1)
  .refine(
    (bands) => bands.every((band, index) => index === 0 || band.maxKm > bands[index - 1]!.maxKm),
    "Distance bands must have strictly increasing maximum distances",
  );
const driverWages = z
  .array(
    z.object({
      hours: z.number().finite().positive(),
      weekdayRate: amount,
      weekendRate: amount,
    }),
  )
  .min(1)
  .refine(
    (tiers) => tiers.every((tier, index) => index === 0 || tier.hours > tiers[index - 1]!.hours),
    "Driver wage tiers must have strictly increasing hours",
  );

export const charterPricingSchema = z.object({
  companyName: z.string().trim().min(1),
  gstPercent: amount.max(100),
  lateDepartureFeePerHour: amount,
  coachKmRates: distanceBands,
  busKmRates: distanceBands,
  driverWages,
  specialRates: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      beforeGst: amount,
      gst: amount,
      customerPrice: amount,
      description: z.string().optional(),
    }),
  ),
  termsAndConditions: z.string(),
});

export const charterPricingUpdateSchema = charterPricingSchema.partial();
