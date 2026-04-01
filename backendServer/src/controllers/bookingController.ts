import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";
import HttpError from "../models/errorModel.js";

// GET /bookings
export const getBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const bookings = await prisma.booking.findMany({
            include: { customer: true },
            orderBy: { createdAt: "desc" }
        });

        const formattedBookings = bookings.map((booking: any) => ({
            id: booking.id,
            customerName: booking.customer.name || 'Unknown',
            customerEmail: booking.customer.email,
            pickupLocation: booking.startLocation,
            dropoffLocation: booking.endLocation,
            passengerCount: booking.passengerCount || 0,
            noOfVehicles: booking.noOfVehicles || 0,
            tripCount: booking.tripCount || 1,
            date: booking.startDateTime.toISOString().split('T')[0],
            startTime: booking.startDateTime.toISOString(),
            endDate: booking.endDateTime ? booking.endDateTime.toISOString().split('T')[0] : null,
            endTime: booking.endDateTime ? booking.endDateTime.toISOString() : null,
            status: booking.status,
            subject: booking.subject,
            bookingDetails: booking.inquiryDetails || "",
            createdAt: booking.createdAt.toISOString(),
            updatedAt: booking.updatedAt.toISOString()
        }));

        res.json(formattedBookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        next(new HttpError("Failed to fetch bookings", 500));
    }
};

// GET /bookings/:id
export const getBookingById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: Number(req.params.id) },
            include: { customer: true, jobs: true }
        });

        if (!booking) {
            res.status(404).json({ error: "Booking not found" });
            return;
        }

        res.json({
            id: booking.id,
            customerName: booking.customer.name || 'Unknown',
            customerEmail: booking.customer.email,
            pickupLocation: booking.startLocation,
            dropoffLocation: booking.endLocation,
            passengerCount: booking.passengerCount || 0,
            noOfVehicles: booking.noOfVehicles || 0,
            tripCount: booking.tripCount || 1,
            date: booking.startDateTime.toISOString().split('T')[0],
            startTime: booking.startDateTime.toISOString(),
            endDate: booking.endDateTime ? booking.endDateTime.toISOString().split('T')[0] : null,
            endTime: booking.endDateTime ? booking.endDateTime.toISOString() : null,
            status: booking.status,
            subject: booking.subject,
            bookingDetails: booking.inquiryDetails || "",
            createdAt: booking.createdAt.toISOString(),
            updatedAt: booking.updatedAt.toISOString()
        });
    } catch (error) {
        console.error("Error fetching booking:", error);
        next(new HttpError("Failed to fetch booking", 500));
    }
};

// POST /bookings
export const createBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { customerName, customerEmail, service, amount, date, startTime, status, pickupLocation, dropoffLocation, passengers, vehicles } = req.body;

        const subject = service || req.body.subject || "Standard Booking";
        const startLocation = pickupLocation || "TBD";
        const endLocation = dropoffLocation || "TBD";

        // Combine date and time more robustly
        let startDateTime = new Date();
        if (date) {
            if (startTime) {
                startDateTime = new Date(`${date}T${startTime}`);
            } else {
                startDateTime = new Date(date);
            }
        }

        if (isNaN(startDateTime.getTime())) {
            res.status(400).json({ error: "Invalid start date or time format" });
            return;
        }

        const passengerCount = passengers || req.body.passengerCount || 1;
        const noOfVehicles = vehicles || req.body.noOfVehicles || 1;

        let endDateTime: Date | null = null;
        if (req.body.endDate && req.body.endTime) {
            endDateTime = new Date(`${req.body.endDate}T${req.body.endTime}`);
        } else if (req.body.endDateTime) {
            endDateTime = new Date(req.body.endDateTime);
        }

        if (endDateTime && isNaN(endDateTime.getTime())) {
            res.status(400).json({ error: "Invalid end date or time format" });
            return;
        }

        if (!customerEmail) {
            res.status(400).json({ error: "Customer Email is required" });
            return;
        }

        let customer = await prisma.customer.findUnique({
            where: { email: customerEmail }
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    email: customerEmail,
                    name: customerName || "New Customer",
                    isActive: true
                }
            });
        }

        const newBooking = await prisma.booking.create({
            data: {
                subject,
                inquiryDetails: req.body.bookingDetails || req.body.inquiryDetails || (amount ? `Amount: ${amount}` : "No details"),
                status: status || "Pending",
                startDateTime,
                startLocation,
                endLocation,
                endDateTime,
                passengerCount: Number(passengerCount),
                noOfVehicles: Number(noOfVehicles),
                tripCount: Number(req.body.tripCount || 1),
                customerId: customer.id
            },
            include: { customer: true }
        });

        res.status(201).json({
            id: newBooking.id,
            customerName: newBooking.customer.name,
            customerEmail: newBooking.customer.email,
            pickupLocation: newBooking.startLocation,
            dropoffLocation: newBooking.endLocation,
            passengerCount: newBooking.passengerCount,
            noOfVehicles: newBooking.noOfVehicles,
            tripCount: newBooking.tripCount,
            bookingDetails: newBooking.inquiryDetails,
            date: newBooking.startDateTime.toISOString().split('T')[0],
            startTime: newBooking.startDateTime.toISOString(),
            endDate: newBooking.endDateTime ? newBooking.endDateTime.toISOString().split('T')[0] : null,
            endTime: newBooking.endDateTime ? newBooking.endDateTime.toISOString() : null,
            status: newBooking.status,
            subject: newBooking.subject,
            createdAt: newBooking.createdAt.toISOString(),
            updatedAt: newBooking.updatedAt.toISOString()
        });
    } catch (error: any) {
        console.error("Error creating booking:", error);
        next(new HttpError("Failed to create booking", 500));
    }
};

// PATCH /bookings/:id
export const updateBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { status, service, amount, pickupLocation, dropoffLocation, passengers, vehicles, date } = req.body;

        const updateData: any = {};
        if (status) updateData.status = status;
        if (service) updateData.subject = service;
        if (amount) updateData.inquiryDetails = `Amount: ${amount}`;
        if (pickupLocation) updateData.startLocation = pickupLocation;
        if (dropoffLocation) updateData.endLocation = dropoffLocation;
        if (passengers || req.body.passengerCount) updateData.passengerCount = Number(passengers || req.body.passengerCount);
        if (vehicles || req.body.noOfVehicles) updateData.noOfVehicles = Number(vehicles || req.body.noOfVehicles);
        if (req.body.tripCount) updateData.tripCount = Number(req.body.tripCount);
        if (req.body.inquiryDetails || req.body.bookingDetails) updateData.inquiryDetails = req.body.inquiryDetails || req.body.bookingDetails;

        if (date) {
            updateData.startDateTime = new Date(date);
        }

        if (req.body.endDate && req.body.endTime) {
            updateData.endDateTime = new Date(`${req.body.endDate}T${req.body.endTime}`);
        } else if (req.body.endDateTime) {
            updateData.endDateTime = new Date(req.body.endDateTime);
        }

        const updatedBooking = await prisma.booking.update({
            where: { id: Number(req.params.id) },
            data: updateData,
            include: { customer: true }
        });

        res.json({
            id: updatedBooking.id,
            customerName: updatedBooking.customer.name,
            customerEmail: updatedBooking.customer.email,
            pickupLocation: updatedBooking.startLocation,
            dropoffLocation: updatedBooking.endLocation,
            passengerCount: updatedBooking.passengerCount,
            noOfVehicles: updatedBooking.noOfVehicles,
            tripCount: updatedBooking.tripCount,
            date: updatedBooking.startDateTime.toISOString().split('T')[0],
            startTime: updatedBooking.startDateTime.toISOString(),
            status: updatedBooking.status,
            subject: updatedBooking.subject,
            createdAt: updatedBooking.createdAt.toISOString(),
            updatedAt: updatedBooking.updatedAt.toISOString()
        });
    } catch (error: any) {
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
        await prisma.booking.update({
            where: { id: Number(req.params.id) },
            data: { status: "Cancelled" },
        });

        res.json({ success: true, id: Number(req.params.id) });
    } catch (error: any) {
        console.error("Error deleting booking:", error);
        next(new HttpError("Failed to delete booking", 500));
    }
};
