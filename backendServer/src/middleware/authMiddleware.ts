import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import HttpError from "../models/errorModel.js";

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(new HttpError("Authorization header is missing", 401));
  }
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const JWT_SECRET = process.env.JWT_SECRET as string;
    const token = authHeader.split(" ")[1];
    try {
      if (!token) {
        return next(new HttpError("Token is missing", 401));
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; // Attach decoded token to request object
      next();
    } catch (error) {
      return next(new HttpError("Invalid token", 401));
    }
  } else {
    return next(new HttpError("Unauthorized", 401));
  }
};
