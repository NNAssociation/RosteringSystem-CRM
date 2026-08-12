import { prisma } from "../db.js";
import type { CreateUserInput, UpdateUserInput } from "../validators/userSchema.js";

// ── Response Mapper ───────────────────────────────────────

function toDriverResponse(user: any) {
  const { id: profileId, userId, ...profileData } = user.profile || {};
  return {
    ...profileData,
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.isActive ? "Active" : "Inactive",
    joinedDate: user.createdAt?.toISOString().split("T")[0],
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
    roles: user.roles,
  };
}

// ── Service Methods ───────────────────────────────────────

export async function getAllUsers(roleFilter?: string) {
  const whereClause: any = { isActive: true };

  if (roleFilter) {
    whereClause.roles = {
      some: {
        role: {
          roleName: { in: roleFilter.split(",") },
        },
      },
    };
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      roles: { include: { role: { select: { id: true, roleName: true } } } },
      profile: true,
    },
  });

  return users;
}

export async function getUserById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: { include: { role: true } },
      profile: true,
    },
  });
  return user;
}

export async function createUser(input: CreateUserInput) {
  // Resolve role
  let roleRecords: any[] = [];
  if (input.roleName) {
    const dbRole = await prisma.role.findUnique({ where: { roleName: input.roleName } });
    if (dbRole) {
      roleRecords.push({ roleId: dbRole.id });
    }
  }

  // Build profile data
  const profileData: any = {};
  if (input.phone || input.phoneNumber1) profileData.phoneNumber1 = input.phone || input.phoneNumber1;
  if (input.phoneNumber2) profileData.phoneNumber2 = input.phoneNumber2;
  if (input.address) profileData.address = input.address;
  if (input.licenseNumber || input.driverLicense) profileData.driverLicense = input.licenseNumber || input.driverLicense;
  if (input.driverLicenseExpiry) profileData.driverLicenseExpiry = new Date(input.driverLicenseExpiry);
  if (input.driverLicenseState) profileData.driverLicenseState = input.driverLicenseState;
  if (input.dateOfBirth) profileData.dateOfBirth = new Date(input.dateOfBirth);
  if (input.maxfatigueMinutes !== undefined) profileData.maxfatigueMinutes = input.maxfatigueMinutes !== null ? Number(input.maxfatigueMinutes) : null;
  if (input.avatarUrl) profileData.avatarUrl = input.avatarUrl;

  const newUser = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      isActive: input.status !== "Inactive",
      profile: Object.keys(profileData).length > 0 ? { create: profileData } : undefined,
      roles: roleRecords.length > 0 ? { create: roleRecords } : undefined,
    },
    include: {
      profile: true,
      roles: { include: { role: true } },
    },
  });

  return newUser;
}

export async function updateUser(id: number, input: UpdateUserInput) {
  const profileData: any = {};
  if (input.phone || input.phoneNumber1) profileData.phoneNumber1 = input.phone || input.phoneNumber1;
  if (input.phoneNumber2 !== undefined) profileData.phoneNumber2 = input.phoneNumber2;
  if (input.address !== undefined) profileData.address = input.address;
  if (input.licenseNumber || input.driverLicense) profileData.driverLicense = input.licenseNumber || input.driverLicense;
  if (input.driverLicenseExpiry !== undefined) profileData.driverLicenseExpiry = input.driverLicenseExpiry ? new Date(input.driverLicenseExpiry) : null;
  if (input.driverLicenseState !== undefined) profileData.driverLicenseState = input.driverLicenseState;
  if (input.dateOfBirth !== undefined) profileData.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if (input.maxfatigueMinutes !== undefined) profileData.maxfatigueMinutes = input.maxfatigueMinutes !== null ? Number(input.maxfatigueMinutes) : null;
  if (input.avatarUrl !== undefined) profileData.avatarUrl = input.avatarUrl;

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email,
      isActive: input.status === undefined ? undefined : input.status !== "Inactive",
      profile: Object.keys(profileData).length > 0
        ? { upsert: { create: profileData, update: profileData } }
        : undefined,
    },
    include: {
      profile: true,
      roles: { include: { role: true } },
    },
  });

  return updatedUser;
}

export async function softDeleteUser(id: number) {
  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
  return { success: true, id };
}

/**
 * Get all drivers with their profiles flattened for the dispatch board.
 */
export async function getDriversForDispatch() {
  const drivers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { roleName: "DRIVER" } } },
    },
    include: {
      roles: { include: { role: { select: { id: true, roleName: true } } } },
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
