import { Router } from "express";
import { getVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle } from "../controllers/fleetController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", getVehicles);
router.get("/:id", getVehicleById);
router.post("/", createVehicle);
router.patch("/:id", updateVehicle);
router.delete("/:id", deleteVehicle);

export default router;
