import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { prisma } from "../db.js";
import { WorkflowError } from "../services/workflowError.js";

export type EmployeeActor = {
  id: number;
  role: string;
  firstName: string | null;
  lastName: string | null;
  clerkId?: string | null;
};
export const isOffice = (actor: EmployeeActor) =>
  ["ADMIN", "MANAGER", "DISPATCHER"].includes(actor.role);
export const employeeSelect = {
  id: true,
  role: true,
  firstName: true,
  lastName: true,
  clerkId: true,
  status: true,
} as const;
export async function resolveEmployee(clerkId: string, db: any = prisma): Promise<EmployeeActor> {
  let employee = await db.user.findUnique({ where: { clerkId }, select: employeeSelect });
  if (!employee) {
    const identity = await clerkClient.users.getUser(clerkId);
    const email = identity.emailAddresses.find(
      (e) => e.id === identity.primaryEmailAddressId && e.verification?.status === "verified",
    )?.emailAddress;
    const candidate = email
      ? await db.user.findUnique({ where: { email }, select: employeeSelect })
      : null;
    if (!candidate || candidate.clerkId || candidate.status !== "ACTIVE" || !candidate.role)
      throw new WorkflowError(
        "Employee access is not configured. Contact your administrator.",
        403,
      );
    const linked = await db.user.updateMany({
      where: { id: candidate.id, clerkId: null, status: "ACTIVE" },
      data: { clerkId },
    });
    if (!linked.count) throw new WorkflowError("Account linking changed. Please try again.", 409);
    employee = { ...candidate, clerkId };
  }
  if (employee.status !== "ACTIVE" || !employee.role)
    throw new WorkflowError("Your employee account is not active.", 403);
  return employee;
}
export const requireEmployee: RequestHandler = async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Sign in to continue" });
      return;
    }
    (req as any).employee = await resolveEmployee(userId);
    next();
  } catch (e: any) {
    res
      .status(e.status || 503)
      .json({ error: e.status ? e.message : "Unable to verify employee access. Try again." });
  }
};
export const requireOffice: RequestHandler = (req, res, next) => {
  if (!isOffice((req as any).employee)) {
    res.status(403).json({ error: "Office staff access is required" });
    return;
  }
  next();
};
