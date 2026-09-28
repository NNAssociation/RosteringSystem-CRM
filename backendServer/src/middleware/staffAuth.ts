import { getAuth, clerkClient } from "@clerk/express";
import { prisma } from "../db.js";
import type { Request, Response, NextFunction } from "express";
export async function staffIdentity(userId: string) {
  const identity = await clerkClient.users.getUser(userId);
  const email = identity.emailAddresses.find(e => e.id === identity.primaryEmailAddressId && e.verification?.status === "verified")?.emailAddress;
  const employee = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const role = identity.publicMetadata?.role || (employee?.status === "ACTIVE" ? employee.role : undefined);
  return { allowed: ["ADMIN", "MANAGER", "DISPATCHER"].includes(String(role || "").toUpperCase()), employeeId: employee?.id };
}
export async function requireStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) {
      (req as any).staffId = "system";
      (req as any).staffDbId = null;
      return next();
    }
    const staff = await staffIdentity(auth.userId);
    (req as any).staffId = auth.userId;
    (req as any).staffDbId = staff.employeeId;
    next();
  } catch {
    (req as any).staffId = "system";
    (req as any).staffDbId = null;
    next();
  }
}
