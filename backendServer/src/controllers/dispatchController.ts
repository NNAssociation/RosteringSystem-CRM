import type { Request, Response, NextFunction } from "express";
import * as DispatchService from "../services/dispatchService.js";
import * as AssignmentService from "../services/assignmentService.js";
import * as AutoScheduleService from "../services/autoScheduleService.js";
import HttpError from "../models/errorModel.js";
import { startOfDay, endOfDay } from "date-fns";

// GET /dispatch/board?date=2024-05-12
export const getBoardData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dateQuery = req.query.date as string;
    const targetDate = dateQuery ? new Date(dateQuery) : new Date();
    
    if (isNaN(targetDate.getTime())) {
       res.status(400).json({ error: "Invalid date format" });
       return;
    }

    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    const data = await DispatchService.getBoardData(start, end);
    res.json(data);
  } catch (error) {
    console.error("Error fetching board data:", error);
    next(new HttpError("Failed to fetch board data", 500));
  }
};

// POST /dispatch/assignments
export const createAssignment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).clerkAuth?.userId ? 1 : 1; // Fallback to 1 for now if clerk config is missing proper mapping to DB user
    const assignment = await AssignmentService.createAssignment(req.body, { userId });
    res.status(201).json(assignment);
  } catch (error: any) {
    console.error("Error creating assignment:", error);
    if (error.name === "ValidationError") {
      res.status(400).json({ error: error.message });
      return;
    }
    next(new HttpError("Failed to create assignment", 500));
  }
};

// PATCH /dispatch/assignments/:id
export const updateAssignment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).clerkAuth?.userId ? 1 : 1;
    const assignment = await AssignmentService.updateAssignment(Number(req.params.id), req.body, { userId });
    res.json(assignment);
  } catch (error: any) {
    console.error("Error updating assignment:", error);
    if (error.name === "ValidationError") {
      res.status(409).json({ error: error.message }); // 409 Conflict is appropriate here
      return;
    }
    next(new HttpError("Failed to update assignment", 500));
  }
};

// DELETE /dispatch/assignments/:id
export const deleteAssignment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).clerkAuth?.userId ? 1 : 1;
    const result = await AssignmentService.deleteAssignment(Number(req.params.id), { userId });
    res.json(result);
  } catch (error) {
    console.error("Error deleting assignment:", error);
    next(new HttpError("Failed to delete assignment", 500));
  }
};

// POST /dispatch/locks
export const acquireLock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { resourceType, resourceId } = req.body;
    const userId = (req as any).clerkAuth?.userId ? 1 : 1;

    const result = await DispatchService.acquireLock(resourceType, resourceId, userId);
    
    if (!result.success) {
       res.status(423).json({ error: result.reason }); // 423 Locked
       return;
    }

    res.json(result);
  } catch (error) {
    console.error("Error acquiring lock:", error);
    next(new HttpError("Failed to acquire lock", 500));
  }
};

// DELETE /dispatch/locks
export const releaseLock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { resourceType, resourceId } = req.body;
    const userId = (req as any).clerkAuth?.userId ? 1 : 1;

    const result = await DispatchService.releaseLock(resourceType, resourceId, userId);
    res.json(result);
  } catch (error) {
    console.error("Error releasing lock:", error);
    next(new HttpError("Failed to release lock", 500));
  }
};

// POST /dispatch/migrate
export const migrateData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { migrateLegacyJobs } = await import("../services/migrationService.js");
    const result = await migrateLegacyJobs();
    res.json(result);
  } catch (error) {
    console.error("Error migrating data:", error);
    next(new HttpError("Failed to migrate data", 500));
  }
};

// GET /dispatch/analytics
export const getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { getDispatchAnalytics } = await import("../services/dispatchService.js");
    const dateQuery = req.query.date ? new Date(req.query.date as string) : new Date();
    const result = await getDispatchAnalytics(dateQuery);
    res.json(result);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    next(new HttpError("Failed to fetch analytics", 500));
  }
};

// GET /dispatch/duty-span?date=2024-05-12
export const getDutySpans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dateQuery = req.query.date as string;
    const targetDate = dateQuery ? new Date(dateQuery) : new Date();
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    const data = await DispatchService.getDutySpans(start, end);
    res.json(data);
  } catch (error) {
    console.error("Error fetching duty spans:", error);
    next(new HttpError("Failed to fetch duty spans", 500));
  }
};

// POST /dispatch/duty-span
export const setDutySpan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {

    const { driverIds, date, startTime, endTime } = req.body;
    
    let numericDriverIds: number[] = [];
    if (Array.isArray(driverIds)) {
      numericDriverIds = driverIds.map(Number).filter(n => !isNaN(n));
    } else if (driverIds !== undefined && driverIds !== null) {
      numericDriverIds = [Number(driverIds)].filter(n => !isNaN(n));
    }

    if (numericDriverIds.length === 0) {
      res.status(400).json({ error: "Invalid or empty driverIds provided." });
      return;
    }

    const targetDate = new Date(date);
    const start = new Date(startTime);
    const end = new Date(endTime);

    const result = await DispatchService.setDutySpan(numericDriverIds, targetDate, start, end);
    res.status(201).json(result);
  } catch (error: any) {
    console.error("Error setting duty span:", error);
    res.status(500).json({ error: "Failed to set duty span", details: error.message || String(error), stack: error.stack });
  }
};

// GET  /dispatch/auto-schedule?date=2024-05-12          → preview (dry run)
// POST /dispatch/auto-schedule?date=2024-05-12&force=1  → execute
export const autoSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dateQuery = req.query.date as string;
    const targetDate = dateQuery ? new Date(dateQuery) : new Date();

    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    if (req.method === "GET") {
      // Dry-run preview — no DB writes
      const preview = await AutoScheduleService.previewAutoScheduling(start, end);
      res.json(preview);
      return;
    }

    // POST → actual run
    const force = req.query.force === "true" || req.query.force === "1";
    const result = await AutoScheduleService.runAutoScheduling(start, end, force);

    if (!result.success) {
      res.status(409).json({ error: result.notes });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error running auto-schedule:", error);
    next(new HttpError("Failed to run auto-schedule", 500));
  }
};

