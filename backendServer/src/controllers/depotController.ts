import type { Request, Response } from "express";
import { prisma } from "../db.js";

export const getDepots = async (req: Request, res: Response) => {
  try {
    const depots = await prisma.depot.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(depots);
  } catch (error) {
    console.error("Error fetching depots:", error);
    res.status(500).json({ error: "Failed to fetch depots" });
  }
};

export const getDepotById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const depot = await prisma.depot.findUnique({
      where: { id: parseInt(id as string, 10) },
    });
    if (!depot) {
      return res.status(404).json({ error: "Depot not found" });
    }
    res.json(depot);
  } catch (error) {
    console.error("Error fetching depot:", error);
    res.status(500).json({ error: "Failed to fetch depot" });
  }
};

export const createDepot = async (req: Request, res: Response) => {
  try {
    const { name, address, lat, lng } = req.body;
    
    if (!name || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newDepot = await prisma.depot.create({
      data: {
        name,
        address,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      }
    });

    res.status(201).json(newDepot);
  } catch (error) {
    console.error("Error creating depot:", error);
    res.status(500).json({ error: "Failed to create depot" });
  }
};

export const updateDepot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, lat, lng } = req.body;

    const updatedDepot = await prisma.depot.update({
      where: { id: parseInt(id as string, 10) },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(lat !== undefined && { lat: parseFloat(lat) }),
        ...(lng !== undefined && { lng: parseFloat(lng) }),
      },
    });

    res.json(updatedDepot);
  } catch (error) {
    console.error("Error updating depot:", error);
    res.status(500).json({ error: "Failed to update depot" });
  }
};

export const deleteDepot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if there are any associated users or vehicles
    const usersCount = await prisma.user.count({ where: { homeDepotId: parseInt(id as string, 10) }});
    const vehiclesCount = await prisma.fleetVehicle.count({ where: { homeDepotId: parseInt(id as string, 10) }});

    if (usersCount > 0 || vehiclesCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete depot because it is assigned to ${usersCount} driver(s) and ${vehiclesCount} vehicle(s). Please reassign them first.` 
      });
    }

    await prisma.depot.delete({
      where: { id: parseInt(id as string, 10) },
    });

    res.json({ message: "Depot deleted successfully" });
  } catch (error) {
    console.error("Error deleting depot:", error);
    res.status(500).json({ error: "Failed to delete depot" });
  }
};
