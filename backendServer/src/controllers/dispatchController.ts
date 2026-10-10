import { addDays, endOfDay, startOfDay, startOfWeek } from "date-fns";
import type { NextFunction, Request, Response } from "express";
import HttpError from "../models/errorModel.js";
import * as AssignmentService from "../services/assignmentService.js";
import * as AutoScheduleService from "../services/autoScheduleService.js";
import {
  addDateDays,
  boardWindow,
  dateTime,
  dayWindow,
  localDate,
} from "../services/businessTime.js";
import * as DispatchService from "../services/dispatchService.js";
import {
  acquireLockSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
} from "../validators/assignmentSchema.js";

// GET /dispatch/board?date=2026-08-18&viewMode=daily|weekly
export const getBoardData = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const dateQuery = req.query.date as string;
    const viewMode = (req.query.viewMode as string) || "daily";
    const targetDate = dateQuery ? new Date(dateQuery) : new Date();

    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    let start = startOfDay(targetDate);
    let end = endOfDay(targetDate);

    if (viewMode === "weekly") {
      const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
      start = startOfDay(weekStart);
      end = endOfDay(addDays(weekStart, 6));
    }

    const window = boardWindow(dateQuery || localDate(new Date()), viewMode === "weekly");
    const data = await DispatchService.getBoardData(window.start, window.end);
    res.json(data);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error fetching board data:", error);
    next(new HttpError("Failed to fetch board data", 500));
  }
};

// POST /dispatch/assignments
export const createAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req as any).employee?.id || (req as any).staffDbId;
    const assignment = await AssignmentService.createAssignment(
      createAssignmentSchema.parse(req.body),
      { userId },
    );
    res.status(201).json(assignment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: error.issues.map((i: any) => i.message).join(", ") });
      return;
    }
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error creating assignment:", error);
    if (error.name === "ValidationError") {
      res.status(400).json({ error: error.message });
      return;
    }
    next(new HttpError("Failed to create assignment", 500));
  }
};

// PATCH /dispatch/assignments/:id
export const updateAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req as any).employee?.id || (req as any).staffDbId;
    const assignment = await AssignmentService.updateAssignment(
      Number(req.params.id),
      updateAssignmentSchema.parse(req.body),
      { userId },
    );
    res.json(assignment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: error.issues.map((i: any) => i.message).join(", ") });
      return;
    }
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error updating assignment:", error);
    if (error.name === "ValidationError") {
      res.status(409).json({ error: error.message }); // 409 Conflict is appropriate here
      return;
    }
    next(new HttpError("Failed to update assignment", 500));
  }
};

// DELETE /dispatch/assignments/:id
export const deleteAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req as any).employee?.id || (req as any).staffDbId;
    const result = await AssignmentService.deleteAssignment(
      Number(req.params.id),
      { userId },
      Number(req.query.version),
    );
    res.json(result);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error deleting assignment:", error);
    next(new HttpError("Failed to delete assignment", 500));
  }
};

// POST /dispatch/locks
export const acquireLock = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { resourceType, resourceId } = acquireLockSchema.parse(req.body);
    if (!((req as any).employee?.id || (req as any).staffDbId)) {
      res
        .status(403)
        .json({ error: "Link your staff account to an employee to use resource locks" });
      return;
    }
    const userId = (req as any).employee?.id || (req as any).staffDbId;

    const result = await DispatchService.acquireLock(resourceType, resourceId, userId);

    if (!result.success) {
      res.status(423).json({ error: result.reason }); // 423 Locked
      return;
    }

    res.json(result);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error acquiring lock:", error);
    next(new HttpError("Failed to acquire lock", 500));
  }
};

// DELETE /dispatch/locks
export const releaseLock = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { resourceType, resourceId } = acquireLockSchema.parse(req.body);
    if (!((req as any).employee?.id || (req as any).staffDbId)) {
      res
        .status(403)
        .json({ error: "Link your staff account to an employee to use resource locks" });
      return;
    }
    const userId = (req as any).employee?.id || (req as any).staffDbId;

    const result = await DispatchService.releaseLock(resourceType, resourceId, userId);
    res.json(result);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error releasing lock:", error);
    next(new HttpError("Failed to release lock", 500));
  }
};

// POST /dispatch/migrate
export const migrateData = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { migrateLegacyJobs } = await import("../services/migrationService.js");
    const result = await migrateLegacyJobs();
    res.json(result);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error migrating data:", error);
    next(new HttpError("Failed to migrate data", 500));
  }
};

// GET /dispatch/analytics
export const getAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { getDispatchAnalytics } = await import("../services/dispatchService.js");
    const dateQuery = req.query.date ? new Date(req.query.date as string) : new Date();
    const result = await getDispatchAnalytics(dateQuery);
    res.json(result);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error fetching analytics:", error);
    next(new HttpError("Failed to fetch analytics", 500));
  }
};

// GET /dispatch/duty-span?date=2024-05-12
export const getDutySpans = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const dateQuery = req.query.date as string;
    const targetDate = dateQuery ? new Date(dateQuery) : new Date();
    const { start, end } = dayWindow(dateQuery || localDate(new Date()));

    const data = await DispatchService.getDutySpans(start, end);
    res.json(data);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error fetching duty spans:", error);
    next(new HttpError("Failed to fetch duty spans", 500));
  }
};

// POST /dispatch/duty-span
export const setDutySpan = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { driverIds, date, startTime, endTime, spans } = req.body;
    const ids = Array.isArray(driverIds) ? driverIds : [driverIds];
    const numericDriverIds = ids.map(Number);
    const inputSpans = spans === undefined ? [{ startTime, endTime }] : spans;
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Array.isArray(inputSpans) ||
      !inputSpans.length ||
      inputSpans.length > 12 ||
      inputSpans.some((s) => !s || typeof s.startTime !== "string" || typeof s.endTime !== "string")
    ) {
      res.status(400).json({ error: "Provide a date and 1–12 valid duty spans." });
      return;
    }
    const targetDate = dateTime(date, "12:00");
    const windows = inputSpans.map((s) => ({
      startTime: s.startTime.includes("T") ? new Date(s.startTime) : dateTime(date, s.startTime),
      endTime: s.endTime.includes("T")
        ? new Date(s.endTime)
        : dateTime(s.endTime < s.startTime ? addDateDays(date, 1) : date, s.endTime),
    }));
    const result = await DispatchService.setDutySpan(numericDriverIds, targetDate, windows);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: error.issues.map((i: any) => i.message).join(", ") });
      return;
    }
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error setting duty span:", error);
    res.status(500).json({
      error: "Failed to set duty span",
      details: error.message || String(error),
      stack: error.stack,
    });
  }
};

// GET  /dispatch/auto-schedule?startDate=2026-07-13&endDate=2026-07-26          → preview (dry run)
// POST /dispatch/auto-schedule?startDate=2026-07-13&endDate=2026-07-26&force=1  → execute
export const autoSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const startDateParam = (req.query.startDate || req.body?.startDate || req.query.date) as string;
    const endDateParam = (req.query.endDate || req.body?.endDate || req.query.date) as string;

    const startDateObj = startDateParam ? new Date(startDateParam) : new Date();
    const endDateObj = endDateParam ? new Date(endDateParam) : startDateObj;

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    const start = dayWindow(startDateParam || localDate(new Date())).start;
    const end = dayWindow(endDateParam || startDateParam || localDate(new Date())).end;
    if (end <= start || end.getTime() - start.getTime() > 367 * 86400000) {
      res.status(400).json({ error: "Select a date range of at most one year" });
      return;
    }

    if (req.method === "GET") {
      // Dry-run preview — no DB writes
      const preview = await AutoScheduleService.previewAutoScheduling(start, end);
      res.json(preview);
      return;
    }

    // POST → actual run
    const force = req.query.force === "true" || req.query.force === "1" || req.body?.force === true;
    const result = await AutoScheduleService.runAutoScheduling(start, end, force);

    if (!result.success) {
      res.status(409).json({ error: result.notes });
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error running auto-schedule:", error);
    next(new HttpError("Failed to run auto-schedule", 500));
  }
};
