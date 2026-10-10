import { Router } from "express";
import {
  createDepot,
  deleteDepot,
  getDepotById,
  getDepots,
  updateDepot,
} from "../controllers/depotController.js";
import { requireClerkAuth as requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// Allow authenticated users to view depots
router.get("/", requireAuth, getDepots);
router.get("/:id", requireAuth, getDepotById);

// Allow authenticated users to modify depots
router.post("/", requireAuth, createDepot);
router.put("/:id", requireAuth, updateDepot);
router.delete("/:id", requireAuth, deleteDepot);

export default router;
