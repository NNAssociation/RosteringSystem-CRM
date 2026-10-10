import { Router } from "express";
import {
  getCharterPricing,
  getSchedulingSettings,
  updateCharterPricing,
  updateSchedulingSettings,
} from "../controllers/settingsController.js";

const router = Router();

router.get("/scheduling", getSchedulingSettings);
router.put("/scheduling", updateSchedulingSettings);

router.get("/charter-pricing", getCharterPricing);
router.put("/charter-pricing", updateCharterPricing);

export default router;
