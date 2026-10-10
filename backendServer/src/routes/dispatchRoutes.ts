import { Router } from "express";
import {
  acquireLock,
  createAssignment,
  deleteAssignment,
  getAnalytics,
  getBoardData,
  getDutySpans,
  migrateData,
  releaseLock,
  setDutySpan,
  updateAssignment,
} from "../controllers/dispatchController.js";
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

// Driver Timesheets & GPS Telematics Auditing
router.get("/timesheets", async (req, res, next) => {
  try {
    const { getDriverTimesheets } = await import("../services/timesheetService.js");
    const date = req.query.date as string | undefined;
    const data = await getDriverTimesheets(date);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/timesheets/:id/approve", async (req, res, next) => {
  try {
    const { approveDriverTimesheet } = await import("../services/timesheetService.js");
    const emp = (req as any).employee;
    const supervisor =
      emp?.firstName || emp?.lastName
        ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim()
        : (req as any).staffId || "Operations Supervisor";
    const result = await approveDriverTimesheet(Number(req.params.id), supervisor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
