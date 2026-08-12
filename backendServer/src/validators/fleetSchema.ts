import { z } from "zod";

// ── Fleet Vehicle Schemas ──────────────────────────────────

export const createVehicleSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().int().min(1900).max(2100),
  licensePlate: z.string().min(1, "License plate is required"),
  regoState: z.string().optional(),
  vin: z.string().min(1, "VIN is required"),
  status: z.string().optional().default("ACTIVE"),
  maxPassengers: z.coerce.number().int().min(0).optional(),
  maxCargoVolume: z.coerce.number().min(0).optional(),
  availableFrom: z.string().optional(),
  availableTo: z.string().optional(),
  homeDepotId: z.coerce.number().int().min(1).optional(),
  assignedDriverId: z.coerce.number().int().min(1).optional().nullable(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
