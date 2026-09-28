import { assertCanDeactivate, changeRecordLifecycle } from "./recordLifecycle.js";
import { prisma } from "../db.js";
import { eventBus } from "../events/eventBus.js";
import { EventTypes } from "../events/eventTypes.js";
import type { CreateVehicleInput, UpdateVehicleInput } from "../validators/fleetSchema.js";

// ── Service Methods ───────────────────────────────────────

const relations = { homeDepot: true, assignedDriver: { select: { id: true, firstName: true, lastName: true, email: true } } };

export async function getAllVehicles(db: any = prisma) {
  const vehicles = await db.fleetVehicle.findMany({
    include: {
      homeDepot: true,
      assignedDriver: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return vehicles;
}

export async function getVehicleById(id: number, db: any = prisma) {
  const vehicle = await db.fleetVehicle.findUnique({
    where: { id },
    include: {
      homeDepot: true,
      assignedDriver: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  return vehicle;
}

export async function createVehicle(input: CreateVehicleInput, db: any = prisma) {
  const newVehicle = await db.fleetVehicle.create({
    data: {
      make: input.make,
      model: input.model,
      year: Number(input.year),
      licensePlate: input.licensePlate,
      regoState: input.regoState,
      vin: input.vin,
      status: input.status || "ACTIVE",
      maxPassengers: input.maxPassengers == null ? null : Number(input.maxPassengers),
      maxCargoVolume: input.maxCargoVolume == null ? null : Number(input.maxCargoVolume),
      availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
      availableTo: input.availableTo ? new Date(input.availableTo) : null,
      homeDepotId: input.homeDepotId,
      assignedDriverId: input.assignedDriverId,
    },
    include: relations,
  });
  return newVehicle;
}

export async function updateVehicle(id: number, input: UpdateVehicleInput, db: any = prisma) {
  if (input.status) input = { ...input, status: input.status.toUpperCase().replaceAll(" ", "_") };
  if (input.status === "INACTIVE" && db === prisma) return prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74021)`;
    await assertCanDeactivate(tx, "fleet", id);
    return updateVehicle(id, input, tx);
  });
  const updateData: any = {};
  if (input.make) updateData.make = input.make;
  if (input.model) updateData.model = input.model;
  if (input.year) updateData.year = Number(input.year);
  if (input.licensePlate) updateData.licensePlate = input.licensePlate;
  if (input.regoState !== undefined) updateData.regoState = input.regoState;
  if (input.vin) updateData.vin = input.vin;
  if (input.status) {
    updateData.status = input.status;

  }
  if (input.maxPassengers !== undefined) updateData.maxPassengers = input.maxPassengers == null ? null : Number(input.maxPassengers);
  if (input.maxCargoVolume !== undefined) updateData.maxCargoVolume = input.maxCargoVolume == null ? null : Number(input.maxCargoVolume);
  if (input.availableFrom !== undefined) updateData.availableFrom = input.availableFrom ? new Date(input.availableFrom) : null;
  if (input.availableTo !== undefined) updateData.availableTo = input.availableTo ? new Date(input.availableTo) : null;
  if (input.homeDepotId !== undefined) updateData.homeDepotId = input.homeDepotId;
  if (input.assignedDriverId !== undefined) updateData.assignedDriverId = input.assignedDriverId;

  const updatedVehicle = await db.fleetVehicle.update({
    where: { id },
    data: updateData,
    include: relations,
  });
  if (input.status) eventBus.publish(EventTypes.VEHICLE_STATUS_CHANGED, { vehicleId: id, status: input.status });
  return updatedVehicle;
}

export async function deactivateVehicle(id: number) {
  return changeRecordLifecycle("fleet", id, false);
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
      assignedDriver: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { make: "asc" },
  });
  return vehicles;
}
