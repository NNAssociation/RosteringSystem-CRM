import type { Request, Response, NextFunction } from "express";
import HttpError from "../models/errorModel.js";
import * as FleetService from "../services/fleetService.js";

// GET /fleet
export const getVehicles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const vehicles = await FleetService.getAllVehicles();
        res.json(vehicles);
    } catch (error) {
        console.error("Error fetching vehicles:", error);
        next(new HttpError("Failed to fetch fleet vehicles", 500));
    }
};

// GET /fleet/:id
export const getVehicleById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const vehicle = await FleetService.getVehicleById(Number(req.params.id));
        if (!vehicle) {
            res.status(404).json({ error: "Vehicle not found" });
            return;
        }
        res.json(vehicle);
    } catch (error) {
        console.error("Error fetching vehicle:", error);
        next(new HttpError("Failed to fetch vehicle", 500));
    }
};

// POST /fleet
export const createVehicle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { make, model, vin, licensePlate, year } = req.body;
        if (!make || !model || !year || !licensePlate || !vin) {
            res.status(400).json({ error: "Make, model, year, licensePlate, and vin are required fields" });
            return;
        }
        const newVehicle = await FleetService.createVehicle(req.body);
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
        const updatedVehicle = await FleetService.updateVehicle(Number(req.params.id), req.body);
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
        const result = await FleetService.deactivateVehicle(Number(req.params.id));
        res.json(result);
    } catch (error: any) {
        console.error("Error deleting vehicle:", error);
        next(new HttpError("Failed to delete vehicle", 500));
    }
};
