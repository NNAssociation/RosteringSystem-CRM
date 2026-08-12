import { z } from "zod";

// ── Assignment Schemas (Dispatch) ─────────────────────────

export const createAssignmentSchema = z.object({
  jobId: z.number().int().positive(),
  driverId: z.number().int().positive().optional(),
  vehicleId: z.number().int().positive().optional(),
  scheduledStart: z.string().min(1, "Scheduled start is required"),
  scheduledEnd: z.string().optional(),
  notes: z.string().optional(),
  travelFromLocation: z.string().optional(),
  travelToMinutes: z.number().int().optional(),
  travelToKm: z.number().optional(),
  bufferMinutes: z.number().int().optional(),
});

export const updateAssignmentSchema = z.object({
  driverId: z.number().int().positive().optional().nullable(),
  vehicleId: z.number().int().positive().optional().nullable(),
  status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  actualStart: z.string().optional(),
  actualEnd: z.string().optional(),
  notes: z.string().optional(),
  version: z.number().int().positive("Version is required for optimistic locking"),
});

export const acquireLockSchema = z.object({
  resourceType: z.enum(["DRIVER", "VEHICLE", "JOB"]),
  resourceId: z.number().int().positive(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type AcquireLockInput = z.infer<typeof acquireLockSchema>;
