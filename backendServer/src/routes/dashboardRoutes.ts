import { Router } from "express";
import { dashboardOverview } from "../services/dashboardService.js";
const router = Router();
router.get("/overview", async (req, res, next) => {
  try { res.json(await dashboardOverview(req.query.date === undefined ? undefined : String(req.query.date))); }
  catch (e: any) { if (e.status) res.status(e.status).json({ error: e.message }); else next(e); }
});
export default router;
