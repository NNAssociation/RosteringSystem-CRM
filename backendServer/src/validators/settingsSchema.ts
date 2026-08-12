import { z } from "zod";

// ── Scheduling Settings Schema ────────────────────────────

export const updateSchedulingSettingsSchema = z.object({
  maxContinuousDrivingMinutes: z.coerce.number().int().min(1, "Must be at least 1 minute").optional(),
  minBreakDurationMinutes: z.coerce.number().int().min(0, "Cannot be negative").optional(),
  maxShiftDurationMinutes: z.coerce.number().int().min(1, "Must be at least 1 minute").optional(),
  bufferMinutes: z.coerce.number().int().min(0, "Cannot be negative").optional(),
  depotTravelBuffer: z.coerce.number().int().min(0, "Cannot be negative").optional(),
  transitTimeMinutes: z.coerce.number().int().min(0, "Cannot be negative").optional(),
}).refine((data) => {
  // If both are provided, maxShift must be > maxContinuousDriving
  if (data.maxShiftDurationMinutes !== undefined && data.maxContinuousDrivingMinutes !== undefined) {
    return data.maxShiftDurationMinutes > data.maxContinuousDrivingMinutes;
  }
  return true;
}, {
  message: "Maximum shift duration must be greater than maximum continuous driving time",
  path: ["maxShiftDurationMinutes"],
});

export type UpdateSchedulingSettingsInput = z.infer<typeof updateSchedulingSettingsSchema>;
