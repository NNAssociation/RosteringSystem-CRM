import { Router } from "express";
import { getSchedulingSettings, updateSchedulingSettings } from "../controllers/settingsController.js";

const router = Router();

router.get("/scheduling", getSchedulingSettings);
router.put("/scheduling", updateSchedulingSettings);

export default router;
