import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import HttpError from "../models/errorModel.js";
import * as SettingsService from "../services/settingsService.js";
import { updateSchedulingSettingsSchema } from "../validators/settingsSchema.js";

// GET /settings/scheduling
export const getSchedulingSettings = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const settings = await SettingsService.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error("Error fetching scheduling settings:", error);
    next(new HttpError("Failed to fetch scheduling settings", 500));
  }
};

// PUT /settings/scheduling
export const updateSchedulingSettings = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = updateSchedulingSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((e: any) => e.message).join(", ") });
      return;
    }

    // If only some values are provided, validate against existing values
    if (
      parsed.data.maxShiftDurationMinutes !== undefined ||
      parsed.data.maxContinuousDrivingMinutes !== undefined
    ) {
      const current = await SettingsService.getSchedulingRules();
      const newMaxShift = parsed.data.maxShiftDurationMinutes ?? current.maxShiftDurationMinutes;
      const newMaxDriving =
        parsed.data.maxContinuousDrivingMinutes ?? current.maxContinuousDrivingMinutes;
      if (newMaxShift <= newMaxDriving) {
        res.status(400).json({
          error: "Maximum shift duration must be greater than maximum continuous driving time",
        });
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

// GET /settings/charter-pricing
export const getCharterPricing = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { getCharterPricingConfig } = await import("../services/charterPricingService.js");
    const config = await getCharterPricingConfig();
    res.json(config);
  } catch (error) {
    console.error("Error fetching charter pricing:", error);
    next(new HttpError("Failed to fetch charter pricing settings", 500));
  }
};

// PUT /settings/charter-pricing
export const updateCharterPricing = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { updateCharterPricingConfig } = await import("../services/charterPricingService.js");
    const updated = await updateCharterPricingConfig(req.body);
    res.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: error.issues.map((issue) => issue.message).join(", ") });
      return;
    }
    console.error("Error updating charter pricing:", error);
    next(new HttpError("Failed to update charter pricing settings", 500));
  }
};
