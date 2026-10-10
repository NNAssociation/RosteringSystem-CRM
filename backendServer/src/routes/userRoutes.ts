import { Router } from "express";
import {
  addAvailability,
  createUser,
  deleteUser,
  getAvailability,
  getUserById,
  getUsers,
  updateUser,
} from "../controllers/userController.js";

const router = Router();

router.get("/", getUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);

router.post("/:id/availability", addAvailability);
router.get("/:id/availability", getAvailability);

export default router;
