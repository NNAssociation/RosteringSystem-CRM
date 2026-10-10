import { Router } from "express";
import { z } from "zod";
import {
  createBooking,
  deleteBooking,
  getBookingById,
  getBookings,
  updateBooking,
} from "../controllers/bookingController.js";
import { calculateBookingRoute } from "../services/bookingRoute.js";

const router = Router();

router.get("/", getBookings);
router.get("/:id", getBookingById);
router.post("/route-preview", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store").json(await calculateBookingRoute(req.body));
  } catch (error: any) {
    res.status(error instanceof z.ZodError ? 400 : error.status || 500).json({
      error:
        error instanceof z.ZodError
          ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
          : error.status
            ? error.message
            : "Route calculation failed. Retry.",
    });
  }
});
router.post("/", createBooking);
router.patch("/:id", updateBooking);
router.delete("/:id", deleteBooking);

export default router;
