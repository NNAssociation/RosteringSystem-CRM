import type { Request, Response, NextFunction } from "express";
import HttpError from "../models/errorModel.js";

/**
 * Feature flags — read from environment variables.
 * Add new flags here as the system evolves.
 */
export const FEATURES = {
  /** Enables the dispatch board module (routes + UI) */
  DISPATCH_ENABLED: process.env.DISPATCH_ENABLED === "true",
} as const;

/**
 * Middleware factory that gates a route behind a feature flag.
 * Usage: router.use("/dispatch", featureGate("DISPATCH_ENABLED"), dispatchRoutes)
 */
export const featureGate = (flag: keyof typeof FEATURES) => {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!FEATURES[flag]) {
      return next(new HttpError(`Feature '${flag}' is not enabled`, 404));
    }
    next();
  };
};
