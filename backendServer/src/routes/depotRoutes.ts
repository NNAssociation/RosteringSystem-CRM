import { Router } from "express";
import { requireClerkAuth as requireAuth } from "../middleware/authMiddleware.js";
import {
  getDepots,
  getDepotById,
  createDepot,
  updateDepot,
  deleteDepot,
} from "../controllers/depotController.js";

const router = Router();

// Allow authenticated users to view depots
router.get("/", requireAuth, getDepots);
router.get("/:id", requireAuth, getDepotById);

// Allow authenticated users to modify depots
router.post("/", requireAuth, createDepot);
router.put("/:id", requireAuth, updateDepot);
router.delete("/:id", requireAuth, deleteDepot);

export default router;
