import type { Request, Response, NextFunction } from "express";
import HttpError from "../models/errorModel.js";
import * as UserService from "../services/userService.js";

// GET /users - fetch all users
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { roles } = req.query;
    const users = await UserService.getAllUsers(roles as string | undefined);
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
  try {
    const user = await UserService.getUserById(Number(req.params.id));
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Error fetching user" });
  }
};

// POST /users - create a new user
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.body.email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    const newUser = await UserService.createUser(req.body);
    res.status(201).json(newUser);
  } catch (error: any) {
    console.error("Error creating user:", error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: "A user with this email already exists." });
      return;
    }
    return next(new HttpError("Error creating user", 500));
  }
};

// PATCH /users/:id - update user
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const updatedUser = await UserService.updateUser(Number(req.params.id), req.body);
    res.json(updatedUser);
  } catch (error: any) {
    console.error("Error updating user:", error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: "User not found" });
      return;
    }
    return next(new HttpError("Error updating user", 500));
  }
};

// DELETE /users/:id - soft delete user
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await UserService.softDeleteUser(Number(req.params.id));
    res.json(result);
  } catch (error) {
    console.error("Error deleting user:", error);
    return next(new HttpError("Error deleting user", 500));
  }
};

// POST /users/:id/availability
export const addAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const block = await UserService.addDriverAvailability(Number(req.params.id), req.body);
    res.status(201).json(block);
  } catch (error) {
    console.error("Error adding availability:", error);
    return next(new HttpError("Error adding availability", 500));
  }
};

// GET /users/:id/availability
export const getAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const blocks = await UserService.getDriverAvailability(Number(req.params.id));
    res.json(blocks);
  } catch (error) {
    console.error("Error fetching availability:", error);
    return next(new HttpError("Error fetching availability", 500));
  }
};
