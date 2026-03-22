import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import HttpError from "../models/errorModel.js";
import jwt from "jsonwebtoken";

import { prisma } from "../db.js";

// GET /users - fetch all users
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { roles } = req.query;
  console.log("Inside getUsers controller : " + roles);

  let whereClause: any = {
    isActive: true,
  };

  if (roles) {
    whereClause.roles = {
      some: {
        role: {
          roleName: {
            in: (roles as string).split(","),
          },
        },
      },
    };
  }
  try {
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        roles: { include: { role: { select: { id: true, roleName: true } } } },
        profile: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return next(new HttpError("Error fetching users", 500));
  }
};

// GET /users/:id - fetch user by ID
export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        roles: { include: { role: true } },
        profile: true,
      },
    });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Error fetching user" });
  }
};

// POST /users - create a new user
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const {
    name,
    email,
    phone,
    licenseNumber,
    status,
    roleName,
    phoneNumber1,
    phoneNumber2,
    address,
    driverLicense,
    driverLicenseExpiry,
    driverLicenseState,
    taxFileNumber,
    bankName,
    bankBSB,
    bankAccount,
    dateOfBirth,
    occupation,
    maxfatigueMinutes,
    avatarUrl
  } = req.body;

  try {
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    let roleRecords: any[] = [];
    if (roleName) {
      const dbRole = await prisma.role.findUnique({
        where: { roleName: roleName }
      });
      if (dbRole) {
        roleRecords.push({ roleId: dbRole.id });
      }
    }

    const profileData: any = {};
    // Handle both legacy 'phone'/'licenseNumber' and new direct fields
    if (phone || phoneNumber1) profileData.phoneNumber1 = phone || phoneNumber1;
    if (phoneNumber2) profileData.phoneNumber2 = phoneNumber2;
    if (address) profileData.address = address;
    if (licenseNumber || driverLicense) profileData.driverLicense = licenseNumber || driverLicense;
    if (driverLicenseExpiry) profileData.driverLicenseExpiry = new Date(driverLicenseExpiry);
    if (driverLicenseState) profileData.driverLicenseState = driverLicenseState;
    if (taxFileNumber) profileData.taxFileNumber = taxFileNumber;
    if (bankName) profileData.bankName = bankName;
    if (bankBSB) profileData.bankBSB = bankBSB;
    if (bankAccount) profileData.bankAccount = Number(bankAccount);
    if (dateOfBirth) profileData.dateOfBirth = new Date(dateOfBirth);
    if (occupation) profileData.occupation = occupation;
    if (maxfatigueMinutes !== undefined) profileData.maxfatigueMinutes = maxfatigueMinutes !== "" ? Number(maxfatigueMinutes) : null;
    if (avatarUrl) profileData.avatarUrl = avatarUrl;

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        isActive: status !== "Inactive",
        profile: Object.keys(profileData).length > 0 ? { create: profileData } : undefined,
        roles: roleRecords.length > 0 ? { create: roleRecords } : undefined,
      },
      include: {
        profile: true,
        roles: { include: { role: true } },
      },
    });

    res.status(201).json(newUser);
  } catch (error: any) {
    console.error("Error creating user:", error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: "A user with this email already exists." });
      return;
    }
    return next(new HttpError("Error creating user", 500));
  }
};

// PATCH /users/:id - update user
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const {
    name,
    email,
    phone,
    licenseNumber,
    status,
    phoneNumber1,
    phoneNumber2,
    address,
    driverLicense,
    driverLicenseExpiry,
    driverLicenseState,
    taxFileNumber,
    bankName,
    bankBSB,
    bankAccount,
    dateOfBirth,
    occupation,
    maxfatigueMinutes,
    avatarUrl
  } = req.body;
  const userId = Number(req.params.id);

  try {
    const profileData: any = {};
    if (phone || phoneNumber1) profileData.phoneNumber1 = phone || phoneNumber1;
    if (phoneNumber2 !== undefined) profileData.phoneNumber2 = phoneNumber2;
    if (address !== undefined) profileData.address = address;
    if (licenseNumber || driverLicense) profileData.driverLicense = licenseNumber || driverLicense;
    if (driverLicenseExpiry !== undefined) profileData.driverLicenseExpiry = driverLicenseExpiry ? new Date(driverLicenseExpiry) : null;
    if (driverLicenseState !== undefined) profileData.driverLicenseState = driverLicenseState;
    if (taxFileNumber !== undefined) profileData.taxFileNumber = taxFileNumber;
    if (bankName !== undefined) profileData.bankName = bankName;
    if (bankBSB !== undefined) profileData.bankBSB = bankBSB;
    if (bankAccount !== undefined) profileData.bankAccount = bankAccount ? Number(bankAccount) : null;
    if (dateOfBirth !== undefined) profileData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (occupation !== undefined) profileData.occupation = occupation;
    if (maxfatigueMinutes !== undefined) profileData.maxfatigueMinutes = maxfatigueMinutes !== "" ? Number(maxfatigueMinutes) : null;
    if (avatarUrl !== undefined) profileData.avatarUrl = avatarUrl;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        isActive: status === undefined ? undefined : status !== "Inactive",
        profile: Object.keys(profileData).length > 0 ? {
          upsert: {
            create: profileData,
            update: profileData
          }
        } : undefined,
      },
      include: {
        profile: true,
        roles: { include: { role: true } },
      },
    });

    res.json(updatedUser);
  } catch (error: any) {
    console.error("Error updating user:", error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: "User not found" });
      return;
    }
    return next(new HttpError("Error updating user", 500));
  }
};

// DELETE /users/:id - soft delete user
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { isActive: false },
    });
    res.json({ success: true, id: Number(req.params.id) });
  } catch (error) {
    console.error("Error deleting user:", error);
    return next(new HttpError("Error deleting user", 500));
  }
};
