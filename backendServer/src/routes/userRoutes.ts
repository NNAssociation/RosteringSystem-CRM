import { Router } from "express";
import { getUsers, getUserById, createUser, updateUser, deleteUser, addAvailability, getAvailability } from "../controllers/userController.js";
import { requireClerkAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", getUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);

router.post("/:id/availability", addAvailability);
router.get("/:id/availability", getAvailability);

export default router;
