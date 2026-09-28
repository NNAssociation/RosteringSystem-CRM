import { assertCanDeactivate, changeRecordLifecycle } from "./recordLifecycle.js";
import { prisma } from "../db.js";
import type { CreateUserInput, UpdateUserInput } from "../validators/userSchema.js";
import { getDepartmentForRole } from "../constants/employee.js";

// ── Response Mapper ───────────────────────────────────────

function toDriverResponse(user: any) {
  const { id: profileId, userId, ...profileData } = user.profile || {};
  return {
    ...user,
    ...profileData,
    phone: profileData.phoneNumber1,
    licenseNumber: profileData.driverLicense,
    id: user.id,
    employeeNumber: user.employeeNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    email: user.email,
    status: user.status,
    joinedDate: user.createdAt?.toISOString().split("T")[0],
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
    department: user.department,
    role: user.role,
    employmentType: user.employmentType,
    address: user.address,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    emergencyContactRelation: user.emergencyContactRelation,
    hireDate: user.hireDate,
    terminationDate: user.terminationDate,
    hourlyRate: user.hourlyRate,
    skills: user.skills,
    hrNotes: user.hrNotes,
  };
}

// ── Service Methods ───────────────────────────────────────

export async function getAllUsers(roleFilter?: string, db: any = prisma) {
  const whereClause: any = {};

  if (roleFilter) {
    whereClause.role = { in: roleFilter.split(",") as any[] };
  }

  const users = await db.user.findMany({
    where: whereClause,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      profile: true,
    },
  });

  return users.map(toDriverResponse);
}

export async function getUserById(id: number, db: any = prisma) {
  const user = await db.user.findUnique({
    where: { id },
    include: {
      profile: true,
    },
  });
  return user ? toDriverResponse(user) : null;
}

export async function createUser(input: CreateUserInput, db: any = prisma) {
  // Build profile data
  const profileData: any = {};
  if (input.phoneNumber1 !== undefined || input.phone !== undefined) profileData.phoneNumber1 = input.phoneNumber1 ?? input.phone;
  if (input.phoneNumber2) profileData.phoneNumber2 = input.phoneNumber2;
  if (input.driverLicense !== undefined || input.licenseNumber !== undefined) profileData.driverLicense = input.driverLicense ?? input.licenseNumber;
  if (input.driverLicenseExpiry) profileData.driverLicenseExpiry = new Date(input.driverLicenseExpiry);
  if (input.driverLicenseState) profileData.driverLicenseState = input.driverLicenseState;
  if (input.dateOfBirth) profileData.dateOfBirth = new Date(input.dateOfBirth);
  if (input.maxfatigueMinutes !== undefined) profileData.maxfatigueMinutes = input.maxfatigueMinutes !== null ? Number(input.maxfatigueMinutes) : null;
  if (input.avatarUrl) profileData.avatarUrl = input.avatarUrl;

  let employeeNumber = input.employeeNumber;
  if (!employeeNumber) {
    const lastUser = await db.user.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });
    const nextId = (lastUser?.id || 0) + 1;
    employeeNumber = `EMP-${String(nextId).padStart(5, "0")}`;
  }

  // Auto-derive department from role (Role is the source of truth)
  const role = input.role ?? 'DRIVER';
  const department = getDepartmentForRole(role);

  const newUser = await db.user.create({
    data: {
      email: input.email,
      employeeNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      address: input.address,
      department: department as any,
      role: role as any,
      employmentType: input.employmentType,
      status: input.status,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelation: input.emergencyContactRelation,
      hireDate: input.hireDate === undefined ? undefined : input.hireDate ? new Date(input.hireDate) : null,
      terminationDate: input.terminationDate === undefined ? undefined : input.terminationDate ? new Date(input.terminationDate) : null,
      hourlyRate: input.hourlyRate,
      skills: input.skills,
      hrNotes: input.hrNotes,
      profile: Object.keys(profileData).length > 0 ? { create: profileData } : undefined,
    },
    include: {
      profile: true,
    },
  });

  return toDriverResponse(newUser);
}

export async function updateUser(id: number, input: UpdateUserInput, db: any = prisma) {
  if (input.status === "INACTIVE" && db === prisma) return prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
    await assertCanDeactivate(tx, "users", id);
    return updateUser(id, input, tx);
  });
  const profileData: any = {};
  if (input.phoneNumber1 !== undefined || input.phone !== undefined) profileData.phoneNumber1 = input.phoneNumber1 ?? input.phone;
  if (input.phoneNumber2 !== undefined) profileData.phoneNumber2 = input.phoneNumber2;
  if (input.driverLicense !== undefined || input.licenseNumber !== undefined) profileData.driverLicense = input.driverLicense ?? input.licenseNumber;
  if (input.driverLicenseExpiry !== undefined) profileData.driverLicenseExpiry = input.driverLicenseExpiry ? new Date(input.driverLicenseExpiry) : null;
  if (input.driverLicenseState !== undefined) profileData.driverLicenseState = input.driverLicenseState;
  if (input.dateOfBirth !== undefined) profileData.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if (input.maxfatigueMinutes !== undefined) profileData.maxfatigueMinutes = input.maxfatigueMinutes !== null ? Number(input.maxfatigueMinutes) : null;
  if (input.avatarUrl !== undefined) profileData.avatarUrl = input.avatarUrl;

  // Auto-derive department from role when role is updated
  const role = input.role;
  const department = role ? getDepartmentForRole(role) : undefined;

  const updatedUser = await db.user.update({
    where: { id },
    data: {
      email: input.email,
      employeeNumber: input.employeeNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      address: input.address,
      department: department as any,
      role: role as any,
      employmentType: input.employmentType,
      status: input.status,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelation: input.emergencyContactRelation,
      hireDate: input.hireDate === undefined ? undefined : input.hireDate ? new Date(input.hireDate) : null,
      terminationDate: input.terminationDate === undefined ? undefined : input.terminationDate ? new Date(input.terminationDate) : null,
      hourlyRate: input.hourlyRate,
      skills: input.skills,
      hrNotes: input.hrNotes,
      profile: Object.keys(profileData).length > 0
        ? { upsert: { create: profileData, update: profileData } }
        : undefined,
    },
    include: {
      profile: true,
    },
  });

  return toDriverResponse(updatedUser);
}

export async function softDeleteUser(id: number) {
  return changeRecordLifecycle("users", id, false);
}

/**
 * Get all drivers with their profiles flattened for the dispatch board.
 */
export async function getDriversForDispatch() {
  const drivers = await prisma.user.findMany({
    where: {
      status: { not: "INACTIVE" },
      role: "DRIVER",
    },
    include: {
      profile: true,
    },
  });
  return drivers.map(toDriverResponse);
}

/**
 * Add a new availability block for a driver
 */
export async function addDriverAvailability(driverId: number, data: { startTime: string, endTime: string, reason?: string, isBlocked?: boolean }) {
  const block = await prisma.driverAvailability.create({
    data: {
      driverId,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      reason: data.reason || "Blocked time",
      isBlocked: data.isBlocked !== false,
    }
  });
  return block;
}

/**
 * Get availability blocks for a driver
 */
export async function getDriverAvailability(driverId: number) {
  const blocks = await prisma.driverAvailability.findMany({
    where: { driverId },
    orderBy: { startTime: 'asc' }
  });
  return blocks;
}
