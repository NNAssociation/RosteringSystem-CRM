import { z } from "zod";
import { ROLES, EMPLOYMENT_TYPES, STATUSES, ROLE_DEPARTMENT_MAP } from "../constants/employee.js";

// ── User / Employee Schemas ─────────────────────────────────

const baseUserFields = {
  email: z.string().email("Valid email is required"),
  employeeNumber: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  phoneNumber1: z.string().optional(),
  phoneNumber2: z.string().optional(),
  address: z.string().optional(),

  // Role is the primary field; department is auto-derived by the service layer
  role: z.enum(ROLES).optional(),
  department: z.enum(["OPERATION", "ADMINISTRATION", "MANAGEMENT"] as const).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  status: z.enum(STATUSES).optional(),

  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  hireDate: z.string().nullable().optional(),
  terminationDate: z.string().nullable().optional(),
  hourlyRate: z.coerce.number().min(0).nullable().optional(),
  skills: z.array(z.string()).optional(),
  hrNotes: z.string().optional(),

  licenseNumber: z.string().optional(),
  driverLicense: z.string().optional(),
  driverLicenseExpiry: z.string().optional(),
  driverLicenseState: z.string().optional(),
  dateOfBirth: z.string().optional(),
  maxfatigueMinutes: z.coerce.number().int().min(0).optional(),
  avatarUrl: z.string().url().optional(),
};

const baseUserSchema = z.object(baseUserFields);

export const createUserSchema = baseUserSchema.refine((data) => {
  // If both role and department are explicitly sent, validate they match the map
  if (data.role && data.department) {
    const expected = ROLE_DEPARTMENT_MAP[data.role];
    return data.department === expected;
  }
  return true;
}, {
  message: "Department does not match the selected role. Department is auto-assigned based on role.",
  path: ["department"],
});

export const updateUserSchema = baseUserSchema.partial().refine((data) => {
  if (data.role && data.department) {
    const expected = ROLE_DEPARTMENT_MAP[data.role];
    return data.department === expected;
  }
  return true;
}, {
  message: "Department does not match the selected role. Department is auto-assigned based on role.",
  path: ["department"],
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
