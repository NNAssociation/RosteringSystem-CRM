import { z } from "zod";

// ── User / Driver Schemas ─────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
  phone: z.string().optional(),
  phoneNumber1: z.string().optional(),
  phoneNumber2: z.string().optional(),
  address: z.string().optional(),
  licenseNumber: z.string().optional(),
  driverLicense: z.string().optional(),
  driverLicenseExpiry: z.string().optional(),
  driverLicenseState: z.string().optional(),
  dateOfBirth: z.string().optional(),
  maxfatigueMinutes: z.coerce.number().int().min(0).optional(),
  avatarUrl: z.string().url().optional(),
  roleName: z.string().optional(),
  status: z.string().optional(),
});

export const updateUserSchema = createUserSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
