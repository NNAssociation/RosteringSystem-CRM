import { z } from "zod";

// ── Customer Schemas ──────────────────────────────────────

export const createCustomerSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
  address: z.string().optional(),
  company: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
