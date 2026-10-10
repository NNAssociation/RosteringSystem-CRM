import type { Request, Response } from "express";
import { prisma } from "../db.js";
import { createDepotSchema, depotIdSchema, updateDepotSchema } from "../validators/depotSchema.js";

export const getDepots = async (req: Request, res: Response) => {
  try {
    const depots = await prisma.depot.findMany({
      orderBy: { name: "asc" },
    });
    res.json(depots);
  } catch (error) {
    console.error("Error fetching depots:", error);
    res.status(500).json({ error: "Failed to fetch depots" });
  }
};

export const getDepotById = async (req: Request, res: Response) => {
  try {
    const parsedId = depotIdSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: "Invalid depot ID" });
    }

    const depot = await prisma.depot.findUnique({
      where: { id: parsedId.data },
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
    const parsed = createDepotSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return res.status(400).json({ error: msg });
    }

    const newDepot = await prisma.depot.create({
      data: {
        name: parsed.data.name,
        address: parsed.data.address || null,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
      },
    });

    res.status(201).json(newDepot);
  } catch (error) {
    console.error("Error creating depot:", error);
    res.status(500).json({ error: "Failed to create depot" });
  }
};

export const updateDepot = async (req: Request, res: Response) => {
  try {
    const parsedId = depotIdSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: "Invalid depot ID" });
    }

    const parsed = updateDepotSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return res.status(400).json({ error: msg });
    }

    const updatedDepot = await prisma.depot.update({
      where: { id: parsedId.data },
      data: parsed.data,
    });

    res.json(updatedDepot);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Depot not found" });
    }
    console.error("Error updating depot:", error);
    res.status(500).json({ error: "Failed to update depot" });
  }
};

export const deleteDepot = async (req: Request, res: Response) => {
  try {
    const parsedId = depotIdSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: "Invalid depot ID" });
    }

    const id = parsedId.data;

    // Check if there are any associated users or vehicles
    const usersCount = await prisma.user.count({
      where: { homeDepotId: id },
    });
    const vehiclesCount = await prisma.fleetVehicle.count({
      where: { homeDepotId: id },
    });

    if (usersCount > 0 || vehiclesCount > 0) {
      return res.status(400).json({
        error: `Cannot delete depot because it is assigned to ${usersCount} driver(s) and ${vehiclesCount} vehicle(s). Please reassign them first.`,
      });
    }

    await prisma.depot.delete({
      where: { id },
    });

    res.json({ message: "Depot deleted successfully" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Depot not found" });
    }
    console.error("Error deleting depot:", error);
    res.status(500).json({ error: "Failed to delete depot" });
  }
};
