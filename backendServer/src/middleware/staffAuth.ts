import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { isOffice, resolveEmployee } from "./employeeAuth.js";
export async function staffIdentity(userId: string) {
  const employee = await resolveEmployee(userId);
  return { allowed: isOffice(employee), employeeId: employee.id };
}
export async function requireStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ error: "Sign in to continue" });
      return;
    }
    const staff = await staffIdentity(auth.userId);
    if (!staff.allowed) {
      res.status(403).json({ error: "A staff role (ADMIN, MANAGER or DISPATCHER) is required" });
      return;
    }
    (req as any).staffId = auth.userId;
    (req as any).staffDbId = staff.employeeId;
    next();
  } catch (e: any) {
    res
      .status(e.status || 503)
      .json({ error: e.status ? e.message : "Unable to verify staff access. Try again." });
  }
}
