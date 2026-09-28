import { Router } from "express";
import { getBookings, getBookingById, createBooking, updateBooking, deleteBooking } from "../controllers/bookingController.js";
import { requireClerkAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", getBookings);
router.get("/:id", getBookingById);
router.post("/", createBooking);
router.patch("/:id", updateBooking);
router.delete("/:id", deleteBooking);

export default router;
