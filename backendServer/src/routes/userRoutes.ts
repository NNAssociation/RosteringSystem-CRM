import { Router } from "express";
import { getUsers, getUserById } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", getUsers);
router.get("/:id", getUserById);
// router.post("/", createUser);
// router.put("/:id", updateUser);
// router.delete("/:id", deleteUser);
// router.post("/login", loginUser);
// router.post("/:id/change-name", authMiddleware, changeUserName);

export default router;
