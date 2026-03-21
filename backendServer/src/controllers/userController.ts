import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import HttpError from "../models/errorModel.js";
import jwt from "jsonwebtoken";
// import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

// GET /users - fetch all users
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { roles } = req.query;
  //console.error("----------------:", roles);
  console.error("----------------:", "Inside getUsers controller : " + roles);
  //let whereClause = {};
  // 1. Initialize whereClause with the mandatory isActive filter
  // let whereClause: Prisma.UserWhereInput = {
  //   isActive: true,
  // };

  let whereClause: any = {
    isActive: true,
  };

  // 2. Add roles filter only if they exist in query
  if (roles) {
    whereClause.roles = {
      some: {
        role: {
          roleName: {
            in: (roles as string).split(","), // e.g., ["ADMIN", "DRIVER"]
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
      // include: { role: true  }, Get full Role table row
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
  const userId = Number(req.params.id);
  console.error(
    "----------------:",
    "Inside getUserById controller : " + userId,
  );
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching an user:", error);
    res.status(500).json({ error: "Error fetching user" });
  }
};
