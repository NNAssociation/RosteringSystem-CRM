import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import HttpError from "../models/errorModel.js";

/**
 * Clerk middleware — initializes Clerk auth on every request.
 * Must be applied as app-level middleware BEFORE routes.
 */
export { clerkMiddleware };

/**
 * Auth guard — protects individual routes by requiring a valid Clerk session.
 * Use: router.get("/", requireClerkAuth, handler)
 */
export const requireClerkAuth = requireAuth({
  signInUrl: "/sign-in",
});

/**
 * Optional auth — extracts user info if present, but doesn't block.
 * Useful for endpoints that behave differently for authed vs anonymous users.
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    (req as any).clerkAuth = auth;
  } catch {
    // No auth present — that's fine
  }
  next();
};

/**
 * Role guard factory — checks if the authenticated user has a specific role.
 * Relies on Clerk session claims or custom metadata.
 * Usage: router.post("/", requireClerkAuth, requireRole("ADMIN"), handler)
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    if (!auth?.userId) {
      return next(new HttpError("Unauthorized", 401));
    }

    // Check role from Clerk's publicMetadata (configure in Clerk Dashboard)
    const userRole = (auth.sessionClaims as any)?.metadata?.role;
    if (roles.length > 0 && !roles.includes(userRole)) {
      return next(new HttpError("Forbidden — insufficient permissions", 403));
    }

    next();
  };
};
