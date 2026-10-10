import { z } from "zod";

export const depotIdSchema = z.coerce
  .number()
  .int("Depot ID must be an integer")
  .positive("Depot ID must be positive");

export const createDepotSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
  address: z.string().trim().max(300, "Address must be under 300 characters").optional().nullable(),
  lat: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lng: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

export const updateDepotSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().max(300).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export type CreateDepotInput = z.infer<typeof createDepotSchema>;
export type UpdateDepotInput = z.infer<typeof updateDepotSchema>;
