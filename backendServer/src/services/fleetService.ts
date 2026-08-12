import { prisma } from "../db.js";
import { eventBus } from "../events/eventBus.js";
import { EventTypes } from "../events/eventTypes.js";
import type { CreateVehicleInput, UpdateVehicleInput } from "../validators/fleetSchema.js";

// ── Service Methods ───────────────────────────────────────

export async function getAllVehicles() {
  const vehicles = await prisma.fleetVehicle.findMany({
    include: {
      fleetJobs: { include: { job: true } },
      homeDepot: true,
      assignedDriver: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return vehicles;
}

export async function getVehicleById(id: number) {
  const vehicle = await prisma.fleetVehicle.findUnique({
    where: { id },
    include: {
      fleetJobs: { include: { job: true } },
      homeDepot: true,
      assignedDriver: { select: { id: true, name: true, email: true } },
    },
  });
  return vehicle;
}

export async function createVehicle(input: CreateVehicleInput) {
  const newVehicle = await prisma.fleetVehicle.create({
    data: {
      make: input.make,
      model: input.model,
      year: Number(input.year),
      licensePlate: input.licensePlate,
      regoState: input.regoState,
      vin: input.vin,
      status: input.status || "ACTIVE",
      maxPassengers: input.maxPassengers ? Number(input.maxPassengers) : null,
      maxCargoVolume: input.maxCargoVolume ? Number(input.maxCargoVolume) : null,
      availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
      availableTo: input.availableTo ? new Date(input.availableTo) : null,
      homeDepotId: input.homeDepotId,
      assignedDriverId: input.assignedDriverId,
    },
  });
  return newVehicle;
}

export async function updateVehicle(id: number, input: UpdateVehicleInput) {
  const updateData: any = {};
  if (input.make) updateData.make = input.make;
  if (input.model) updateData.model = input.model;
  if (input.year) updateData.year = Number(input.year);
  if (input.licensePlate) updateData.licensePlate = input.licensePlate;
  if (input.regoState) updateData.regoState = input.regoState;
  if (input.vin) updateData.vin = input.vin;
  if (input.status) {
    updateData.status = input.status;
    eventBus.publish(EventTypes.VEHICLE_STATUS_CHANGED, { vehicleId: id, status: input.status });
  }
  if (input.maxPassengers !== undefined) updateData.maxPassengers = input.maxPassengers ? Number(input.maxPassengers) : null;
  if (input.maxCargoVolume !== undefined) updateData.maxCargoVolume = input.maxCargoVolume ? Number(input.maxCargoVolume) : null;
  if (input.availableFrom !== undefined) updateData.availableFrom = input.availableFrom ? new Date(input.availableFrom) : null;
  if (input.availableTo !== undefined) updateData.availableTo = input.availableTo ? new Date(input.availableTo) : null;
  if (input.homeDepotId !== undefined) updateData.homeDepotId = input.homeDepotId;
  if (input.assignedDriverId !== undefined) updateData.assignedDriverId = input.assignedDriverId;

  const updatedVehicle = await prisma.fleetVehicle.update({
    where: { id },
    data: updateData,
  });
  return updatedVehicle;
}

export async function deactivateVehicle(id: number) {
  await prisma.fleetVehicle.update({
    where: { id },
    data: { status: "INACTIVE" },
  });
  eventBus.publish(EventTypes.VEHICLE_STATUS_CHANGED, { vehicleId: id, status: "INACTIVE" });
  return { success: true, id };
}

/**
 * Get vehicles available for dispatch within a time window.
 */
export async function getAvailableVehicles(start: Date, end: Date) {
  const vehicles = await prisma.fleetVehicle.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { availableFrom: null, availableTo: null },
        { availableFrom: { lte: end }, availableTo: { gte: start } },
      ],
    },
    include: {
      homeDepot: true,
      assignedDriver: { select: { id: true, name: true, email: true } },
    },
    orderBy: { make: "asc" },
  });
  return vehicles;
}
