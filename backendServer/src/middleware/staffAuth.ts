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
  if (!auth.userId) { res.status(401).json({ error: "Sign in to continue" }); return; }
  const staff = await staffIdentity(auth.userId);
  if (!staff.allowed) { res.status(403).json({ error: "A staff role (ADMIN, MANAGER or DISPATCHER) is required" }); return; }
  (req as any).staffId = auth.userId; (req as any).staffDbId = staff.employeeId; next();
  } catch { res.status(503).json({ error: "Unable to verify staff access. Try again." }); }
}
