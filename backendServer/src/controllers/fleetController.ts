import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";
import HttpError from "../models/errorModel.js";

// GET /fleet
export const getVehicles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const vehicles = await prisma.fleetVehicle.findMany({
            include: { fleetJobs: { include: { job: true } } },
            orderBy: { createdAt: "desc" }
        });
        res.json(vehicles);
    } catch (error) {
        console.error("Error fetching vehicles:", error);
        next(new HttpError("Failed to fetch fleet vehicles", 500));
    }
};

// GET /fleet/:id
export const getVehicleById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const vehicle = await prisma.fleetVehicle.findUnique({
            where: { id: Number(req.params.id) },
            include: { fleetJobs: { include: { job: true } } }
        });

        if (!vehicle) {
            res.status(404).json({ error: "Vehicle not found" });
            return;
        }

        res.json(vehicle);
        return;
    } catch (error) {
        console.error("Error fetching vehicle:", error);
        next(new HttpError("Failed to fetch vehicle", 500));
    }
};

// POST /fleet
export const createVehicle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { make, model, year, licensePlate, regoState, vin, status, maxPassengers, maxCargoVolume, availableFrom, availableTo } = req.body;

        if (!make || !model || !year || !licensePlate || !vin) {
            res.status(400).json({ error: "Make, model, year, licensePlate, and vin are required fields" });
            return;
        }

        const newVehicle = await prisma.fleetVehicle.create({
            data: {
                make,
                model,
                year: Number(year),
                licensePlate,
                regoState,
                vin,
                status: status || "ACTIVE",
                maxPassengers: maxPassengers ? Number(maxPassengers) : null,
                maxCargoVolume: maxCargoVolume ? Number(maxCargoVolume) : null,
                availableFrom: availableFrom ? new Date(availableFrom) : null,
                availableTo: availableTo ? new Date(availableTo) : null
            },
        });

        res.status(201).json(newVehicle);
    } catch (error: any) {
        console.error("Error creating vehicle:", error);
        if (error.code === 'P2002') {
            res.status(400).json({ error: "A vehicle with this license plate or VIN already exists" });
            return;
        }
        next(new HttpError("Failed to create vehicle", 500));
    }
};

// PATCH /fleet/:id
export const updateVehicle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { make, model, year, licensePlate, regoState, vin, status, maxPassengers, maxCargoVolume, availableFrom, availableTo } = req.body;

        const updateData: any = {};
        if (make) updateData.make = make;
        if (model) updateData.model = model;
        if (year) updateData.year = Number(year);
        if (licensePlate) updateData.licensePlate = licensePlate;
        if (regoState) updateData.regoState = regoState;
        if (vin) updateData.vin = vin;
        if (status) updateData.status = status;
        if (maxPassengers !== undefined) updateData.maxPassengers = maxPassengers ? Number(maxPassengers) : null;
        if (maxCargoVolume !== undefined) updateData.maxCargoVolume = maxCargoVolume ? Number(maxCargoVolume) : null;
        if (availableFrom !== undefined) updateData.availableFrom = availableFrom ? new Date(availableFrom) : null;
        if (availableTo !== undefined) updateData.availableTo = availableTo ? new Date(availableTo) : null;

        const updatedVehicle = await prisma.fleetVehicle.update({
            where: { id: Number(req.params.id) },
            data: updateData,
        });

        res.json(updatedVehicle);
    } catch (error: any) {
        console.error("Error updating vehicle:", error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: "Vehicle not found" });
            return;
        }
        next(new HttpError("Failed to update vehicle", 500));
    }
};

// DELETE /fleet/:id
export const deleteVehicle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Delete the record completely or mark as INACTIVE
        await prisma.fleetVehicle.update({
            where: { id: Number(req.params.id) },
            data: { status: "INACTIVE" },
        });

        res.json({ success: true, id: Number(req.params.id) });
    } catch (error: any) {
        console.error("Error deleting vehicle:", error);
        next(new HttpError("Failed to delete vehicle", 500));
    }
};
