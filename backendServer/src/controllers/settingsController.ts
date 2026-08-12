import type { Request, Response, NextFunction } from "express";
import HttpError from "../models/errorModel.js";
import * as SettingsService from "../services/settingsService.js";
import { updateSchedulingSettingsSchema } from "../validators/settingsSchema.js";

// GET /settings/scheduling
export const getSchedulingSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settings = await SettingsService.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error("Error fetching scheduling settings:", error);
    next(new HttpError("Failed to fetch scheduling settings", 500));
  }
};

// PUT /settings/scheduling
export const updateSchedulingSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateSchedulingSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((e: any) => e.message).join(", ") });
      return;
    }

    // If only some values are provided, validate against existing values
    if (parsed.data.maxShiftDurationMinutes !== undefined || parsed.data.maxContinuousDrivingMinutes !== undefined) {
      const current = await SettingsService.getSchedulingRules();
      const newMaxShift = parsed.data.maxShiftDurationMinutes ?? current.maxShiftDurationMinutes;
      const newMaxDriving = parsed.data.maxContinuousDrivingMinutes ?? current.maxContinuousDrivingMinutes;
      if (newMaxShift <= newMaxDriving) {
        res.status(400).json({ error: "Maximum shift duration must be greater than maximum continuous driving time" });
        return;
      }
    }

    const updates: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    const result = await SettingsService.updateSettings(updates);
    res.json(result);
  } catch (error) {
    console.error("Error updating scheduling settings:", error);
    next(new HttpError("Failed to update scheduling settings", 500));
  }
};
