import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Attaches a unique request ID to every incoming request for distributed tracing.
 * If the client sends an `x-request-id` header, it is reused; otherwise a new UUID is generated.
 * The ID is also set on the response headers for client-side correlation.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};
