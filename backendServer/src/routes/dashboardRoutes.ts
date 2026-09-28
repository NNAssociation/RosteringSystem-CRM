import { Router } from "express";
import { requireStaff } from "../middleware/staffAuth.js";
import { dashboardOverview } from "../services/dashboardService.js";
const router = Router();
router.use(requireStaff);
router.get("/overview", async (req, res, next) => {
  try { res.json(await dashboardOverview(req.query.date === undefined ? undefined : String(req.query.date))); }
  catch (e: any) { if (e.status) res.status(e.status).json({ error: e.message }); else next(e); }
});
export default router;
