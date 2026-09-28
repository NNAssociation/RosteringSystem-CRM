import { Router } from "express";
import { getBoardData, createAssignment, updateAssignment, deleteAssignment, acquireLock, releaseLock, migrateData, getAnalytics, getDutySpans, setDutySpan, autoSchedule } from "../controllers/dispatchController.js";
import { requireClerkAuth } from "../middleware/authMiddleware.js";
import { featureGate } from "../middleware/featureFlag.js";

const router = Router();

// Only enable if DISPATCH_ENABLED=true
router.use(featureGate("DISPATCH_ENABLED"));
// We can apply requireClerkAuth here or let index.ts do it

router.get("/board", getBoardData);
router.post("/assignments", createAssignment);
router.patch("/assignments/:id", updateAssignment);
router.delete("/assignments/:id", deleteAssignment);

router.post("/locks", acquireLock);
router.delete("/locks", releaseLock);

router.post("/migrate", migrateData);
router.get("/analytics", getAnalytics);
router.get("/duty-span", getDutySpans);
router.post("/duty-span", setDutySpan);

// Auto-scheduling
router.get("/auto-schedule", autoSchedule);   // preview (dry-run)
router.post("/auto-schedule", autoSchedule);  // execute

export default router;
