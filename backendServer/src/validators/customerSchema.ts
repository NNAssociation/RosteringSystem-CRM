import { z } from "zod";

// ── Customer Schemas ──────────────────────────────────────

export const createCustomerSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
  address: z.string().optional(),
  company: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
  
  customerType: z.enum(["ORGANIZATION", "CORPORATE", "TRAVEL_AGENT", "SCHOOL", "COMMUNITY_GROUP", "INDIVIDUAL", "OTHER"]).optional(),
  contactName: z.string().optional(),
  contactRole: z.string().optional(),
  taxId: z.string().optional(),
  preferredPaymentMethod: z.enum(["CREDIT_CARD", "INVOICE", "BANK_TRANSFER", "CASH"]).optional(),
  paymentTerms: z.enum(["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_60"]).optional(),
  internalNotes: z.string().optional(),
  isVip: z.boolean().optional(),
  accountStanding: z.enum(["GOOD", "WARNING", "SUSPENDED"]).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
