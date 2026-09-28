import type { Request, Response, NextFunction } from "express";
import * as BookingService from "../services/bookingService.js";
import HttpError from "../models/errorModel.js";
import { createBookingSchema, updateBookingSchema } from "../validators/bookingSchema.js";

// GET /bookings
export const getBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const bookings = await BookingService.getAllBookings();
        res.json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        next(new HttpError("Failed to fetch bookings", 500));
    }
};

// GET /bookings/:id
export const getBookingById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const booking = await BookingService.getBookingById(Number(req.params.id));
        if (!booking) {
            res.status(404).json({ error: "Booking not found" });
            return;
        }
        res.json(booking);
    } catch (error) {
        console.error("Error fetching booking:", error);
        next(new HttpError("Failed to fetch booking", 500));
    }
};

// POST /bookings
export const createBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parseResult = createBookingSchema.safeParse(req.body);
        if (!parseResult.success) {
            const msg = parseResult.error.issues.map((i) => i.message).join(", ");
            res.status(400).json({ error: msg });
            return;
        }
        const result = await BookingService.createBooking(parseResult.data);
        res.status(201).json(result);
    } catch (error: any) {
        if (error.status) { res.status(error.status).json({ error: error.message }); return; }
        console.error("Error creating booking:", error);
        if (error.name === "ValidationError") {
            res.status(400).json({ error: error.message });
            return;
        }
        next(new HttpError("Failed to create booking", 500));
    }
};

// PATCH /bookings/:id
export const updateBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parseResult = updateBookingSchema.safeParse(req.body);
        if (!parseResult.success) {
            const msg = parseResult.error.issues.map((i) => i.message).join(", ");
            res.status(400).json({ error: msg });
            return;
        }
        const result = await BookingService.updateBooking(Number(req.params.id), parseResult.data);
        res.json(result);
    } catch (error: any) {
        if (error.status) { res.status(error.status).json({ error: error.message }); return; }
        console.error("Error updating booking:", error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: "Booking not found" });
            return;
        }
        next(new HttpError("Failed to update booking", 500));
    }
};

// DELETE /bookings/:id
export const deleteBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await BookingService.cancelBooking(Number(req.params.id));
        res.json(result);
    } catch (error: any) {
        if (error.status) { res.status(error.status).json({ error: error.message }); return; }
        console.error("Error deleting booking:", error);
        next(new HttpError("Failed to delete booking", 500));
    }
};
