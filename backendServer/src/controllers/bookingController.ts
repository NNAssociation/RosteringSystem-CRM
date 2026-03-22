import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";
import HttpError from "../models/errorModel.js";

// GET /bookings
export const getBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const inquiries = await prisma.inquiry.findMany({
            include: { customer: true },
            orderBy: { createdAt: "desc" }
        });

        const formattedBookings = inquiries.map((inq: any) => ({
            id: inq.id,
            customerName: inq.customer.name || 'Unknown',
            customerEmail: inq.customer.email,
            pickupLocation: inq.startLocation,
            dropoffLocation: inq.endLocation,
            passengerCount: inq.passengerCount || 0,
            noOfVehicles: inq.noOfVehicles || 0,
            tripCount: inq.tripCount || 1,
            date: inq.startDateTime.toISOString().split('T')[0],
            startTime: inq.startDateTime.toISOString(),
            status: inq.status,
            subject: inq.subject,
            inquiryDetails: inq.inquiryDetails || "",
            createdAt: inq.createdAt.toISOString(),
            updatedAt: inq.updatedAt.toISOString()
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
        const inquiry = await prisma.inquiry.findUnique({
            where: { id: Number(req.params.id) },
            include: { customer: true, jobs: true }
        });

        if (!inquiry) {
            res.status(404).json({ error: "Booking not found" });
            return;
        }

        res.json({
            id: inquiry.id,
            customerName: inquiry.customer.name || 'Unknown',
            customerEmail: inquiry.customer.email,
            pickupLocation: inquiry.startLocation,
            dropoffLocation: inquiry.endLocation,
            passengerCount: inquiry.passengerCount || 0,
            noOfVehicles: inquiry.noOfVehicles || 0,
            tripCount: inquiry.tripCount || 1,
            date: inquiry.startDateTime.toISOString().split('T')[0],
            startTime: inquiry.startDateTime.toISOString(),
            status: inquiry.status,
            subject: inquiry.subject,
            inquiryDetails: inquiry.inquiryDetails || "",
            createdAt: inquiry.createdAt.toISOString(),
            updatedAt: inquiry.updatedAt.toISOString()
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

        const newInquiry = await prisma.inquiry.create({
            data: {
                subject,
                inquiryDetails: req.body.inquiryDetails || (amount ? `Amount: ${amount}` : "No details"),
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
            id: newInquiry.id,
            customerName: newInquiry.customer.name,
            customerEmail: newInquiry.customer.email,
            pickupLocation: newInquiry.startLocation,
            dropoffLocation: newInquiry.endLocation,
            passengerCount: newInquiry.passengerCount,
            noOfVehicles: newInquiry.noOfVehicles,
            tripCount: newInquiry.tripCount,
            inquiryDetails: newInquiry.inquiryDetails,
            date: newInquiry.startDateTime.toISOString().split('T')[0],
            startTime: newInquiry.startDateTime.toISOString(),
            endDate: newInquiry.endDateTime ? newInquiry.endDateTime.toISOString().split('T')[0] : null,
            endTime: newInquiry.endDateTime ? newInquiry.endDateTime.toISOString() : null,
            status: newInquiry.status,
            subject: newInquiry.subject,
            createdAt: newInquiry.createdAt.toISOString(),
            updatedAt: newInquiry.updatedAt.toISOString()
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
        if (req.body.inquiryDetails) updateData.inquiryDetails = req.body.inquiryDetails;

        if (date) {
            updateData.startDateTime = new Date(date);
        }

        if (req.body.endDate && req.body.endTime) {
            updateData.endDateTime = new Date(`${req.body.endDate}T${req.body.endTime}`);
        } else if (req.body.endDateTime) {
            updateData.endDateTime = new Date(req.body.endDateTime);
        }

        const updatedInquiry = await prisma.inquiry.update({
            where: { id: Number(req.params.id) },
            data: updateData,
            include: { customer: true }
        });

        res.json({
            id: updatedInquiry.id,
            customerName: updatedInquiry.customer.name,
            customerEmail: updatedInquiry.customer.email,
            pickupLocation: updatedInquiry.startLocation,
            dropoffLocation: updatedInquiry.endLocation,
            passengerCount: updatedInquiry.passengerCount,
            noOfVehicles: updatedInquiry.noOfVehicles,
            tripCount: updatedInquiry.tripCount,
            date: updatedInquiry.startDateTime.toISOString().split('T')[0],
            startTime: updatedInquiry.startDateTime.toISOString(),
            status: updatedInquiry.status,
            subject: updatedInquiry.subject,
            createdAt: updatedInquiry.createdAt.toISOString(),
            updatedAt: updatedInquiry.updatedAt.toISOString()
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
        await prisma.inquiry.update({
            where: { id: Number(req.params.id) },
            data: { status: "Cancelled" },
        });

        res.json({ success: true, id: Number(req.params.id) });
    } catch (error: any) {
        console.error("Error deleting booking:", error);
        next(new HttpError("Failed to delete booking", 500));
    }
};
