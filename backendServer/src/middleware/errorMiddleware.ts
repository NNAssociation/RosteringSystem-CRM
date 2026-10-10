import type { NextFunction, Request, Response } from "express";
import HttpError from "../models/errorModel.js";

/**
 * 404 handler — catches requests that don't match any route.
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new HttpError("Not Found", 404);
  next(error);
};

/**
 * Global error handler — catches all errors thrown/nexted in the app.
 * Must have 4 parameters for Express to recognize it as an error handler.
 */
export const errorHandler = (
  err: Error | HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const candidate =
    "statusCode" in err
      ? err.statusCode
      : "status" in err
        ? Number(err.status)
        : res.statusCode !== 200
          ? res.statusCode
          : 500;
  const statusCode =
    Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;

  console.error(`[ERROR] ${req.method} status=${statusCode}`);
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? "Unable to complete request" : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};
