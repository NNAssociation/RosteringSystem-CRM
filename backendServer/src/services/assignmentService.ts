import { prisma } from "../db.js";
import { eventBus } from "../events/eventBus.js";
import { EventTypes } from "../events/eventTypes.js";
import type { CreateAssignmentInput, UpdateAssignmentInput } from "../validators/assignmentSchema.js";
import { checkDriverConflict, checkVehicleConflict, checkDriverFatigue } from "./conflictService.js";
import { ValidationError } from "./bookingService.js";
import { getTravelTime } from "./googleMapsService.js";
import { getSchedulingRules } from "./settingsService.js";
import { startOfDay, endOfDay } from "date-fns";

// ── Service Methods ───────────────────────────────────────

export async function adjustDriverDutySpan(tx: any, driverId: number, date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // Fetch all assignments on this day for the driver
  const assignments = await tx.assignment.findMany({
    where: {
      driverId,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      scheduledStart: { gte: dayStart, lte: dayEnd }
    },
    include: {
      job: {
        include: { booking: true }
      }
    }
  });

  if (assignments.length === 0) {
    // Delete duty span if no assignments left
    await tx.driverAvailability.deleteMany({
      where: {
        driverId,
        startTime: { gte: dayStart, lte: dayEnd },
        isBlocked: false
      }
    });
    return;
  }

  // Sort assignments by scheduledStart
  assignments.sort((a: any, b: any) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  const first = assignments[0];
  const last = assignments[assignments.length - 1];
  const firstJob = first.job;
  const lastJob = last.job;

  // Find driver's assigned vehicle to get depot location
  const assignedVehicle = await tx.fleetVehicle.findFirst({
    where: { assignedDriverId: driverId },
    include: { homeDepot: true }
  });
  const depotLat = assignedVehicle?.homeDepot?.lat ?? -33.9482; // Fallback
  const depotLng = assignedVehicle?.homeDepot?.lng ?? 151.0506;
  const depotAddress = assignedVehicle?.homeDepot?.name ?? "99 Belmore Rd, Riverwood NSW 2210, Australia";

  const firstOrigin = (firstJob.jobStartLat && firstJob.jobStartLng)
    ? { lat: firstJob.jobStartLat, lng: firstJob.jobStartLng }
    : depotAddress;

  const lastDest = (lastJob.jobEndLat && lastJob.jobEndLng)
    ? { lat: lastJob.jobEndLat, lng: lastJob.jobEndLng }
    : depotAddress;

  // Calculate travel times
  const depotToFirst = await getTravelTime(
    { lat: depotLat, lng: depotLng },
    firstOrigin
  );

  const lastToDepot = await getTravelTime(
    lastDest,
    { lat: depotLat, lng: depotLng }
  );

  const rules = await getSchedulingRules();
  const travelFromDepotBuffer = depotToFirst.durationMinutes + rules.depotTravelBuffer;
  const shiftStart = new Date(new Date(first.scheduledStart).getTime() - travelFromDepotBuffer * 60 * 1000);
  const shiftEnd = new Date(new Date(last.scheduledEnd).getTime() + lastToDepot.durationMinutes * 60 * 1000);

  // Find existing duty span
  const existingSpan = await tx.driverAvailability.findFirst({
    where: {
      driverId,
      startTime: { gte: dayStart, lte: dayEnd },
      isBlocked: false
    }
  });

  if (existingSpan) {
    await tx.driverAvailability.update({
      where: { id: existingSpan.id },
      data: {
        startTime: shiftStart,
        endTime: shiftEnd
      }
    });
  } else {
    await tx.driverAvailability.create({
      data: {
        driverId,
        startTime: shiftStart,
        endTime: shiftEnd,
        isBlocked: false,
        reason: "Duty Span"
      }
    });
  }
}

export async function createAssignment(input: CreateAssignmentInput, meta?: { userId?: number | undefined }) {
  const start = new Date(input.scheduledStart);
  
  // Need to calculate an end time if not provided
  let end: Date;
  if (input.scheduledEnd) {
    end = new Date(input.scheduledEnd);
  } else {
    // Lookup job to get duration, default to 2 hours if missing
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    if (!job) throw new ValidationError("Job not found");
    
    const hours = job.durationHours ? Number(job.durationHours) : 2;
    end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  }

  // 1. Conflict Checks
  const rules = await getSchedulingRules();

  if (input.vehicleId && input.jobId) {
    const job = await prisma.job.findUnique({ where: { id: input.jobId }, include: { booking: true } });
    if (job?.booking?.passengerCount) {
      const { checkVehicleCapacity } = await import('./conflictService.js');
      const capacityResult = await checkVehicleCapacity(input.vehicleId, job.booking.passengerCount);
      if (capacityResult.hasConflict) throw new ValidationError(capacityResult.reason || 'Vehicle capacity exceeded');
    }
  }

  if (input.driverId) {
    const driverConflict = await checkDriverConflict(input.driverId, start, end, undefined, input.jobId, rules);
    if (driverConflict.hasConflict) throw new ValidationError(driverConflict.reason || "Driver conflict");

    // Lookup job to get duration
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    const hours = job?.durationHours ? Number(job.durationHours) : 2;

    const fatigueConflict = await checkDriverFatigue(input.driverId, start, hours);
    if (fatigueConflict.hasConflict) throw new ValidationError(fatigueConflict.reason || "Fatigue conflict");
  }

  if (input.vehicleId) {
    const vehicleConflict = await checkVehicleConflict(input.vehicleId, start, end);
    if (vehicleConflict.hasConflict) throw new ValidationError(vehicleConflict.reason || "Vehicle conflict");
  }

  // 2. Create Assignment sequentially
  const newAssignment = await prisma.assignment.create({
    data: {
      jobId: input.jobId,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      scheduledStart: start,
      scheduledEnd: end,
      notes: input.notes,
      createdBy: meta?.userId,
      status: "CONFIRMED",
      travelFromLocation: input.travelFromLocation,
      travelToMinutes: input.travelToMinutes,
      travelToKm: input.travelToKm,
      bufferMinutes: input.bufferMinutes,
    },
    include: { job: true, driver: true, vehicle: true },
  });

  // Update Job status to CONFIRMED if it was in an unassigned state
  const UNASSIGNED_STATUSES = ["UNASSIGNED", "OPEN", "PENDING"];
  if (UNASSIGNED_STATUSES.includes(newAssignment.job.status)) {
    await prisma.job.update({
      where: { id: input.jobId },
      data: { status: "CONFIRMED" },
    });
  }

  if (input.driverId) {
    await adjustDriverDutySpan(prisma, input.driverId, start);
  }

  // 3. Emit Events
  eventBus.publish(EventTypes.ASSIGNMENT_CREATED, newAssignment, meta);
  
  if (UNASSIGNED_STATUSES.includes(newAssignment.job.status)) {
     eventBus.publish(EventTypes.JOB_UPDATED, { jobId: input.jobId, status: "CONFIRMED" }, meta);
  }

  return newAssignment;
}

export async function updateAssignment(id: number, input: UpdateAssignmentInput, meta?: { userId?: number | undefined }) {
  // 1. Fetch current assignment to verify optimistic locking version
  const current = await prisma.assignment.findUnique({ where: { id }, include: { job: true } });
  if (!current) throw new ValidationError("Assignment not found");
  
  if (current.version !== input.version) {
    throw new ValidationError("Assignment has been modified by another user. Please refresh and try again.");
  }

  // Prepare times for conflict checks
  const start = input.scheduledStart ? new Date(input.scheduledStart) : current.scheduledStart;
  let end: Date;
  if (input.scheduledEnd) {
    end = new Date(input.scheduledEnd);
  } else if (current.scheduledEnd) {
    end = current.scheduledEnd;
  } else {
    const hours = current.job.durationHours ? Number(current.job.durationHours) : 2;
    end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  }

  // 2. Conflict Checks if Driver or Vehicle is changing, or Times are changing
  const driverId = input.driverId !== undefined ? input.driverId : current.driverId;
  const vehicleId = input.vehicleId !== undefined ? input.vehicleId : current.vehicleId;
  
  const rules = await getSchedulingRules();

  if (vehicleId && current.jobId) {
    const job = await prisma.job.findUnique({ where: { id: current.jobId }, include: { booking: true } });
    if (job?.booking?.passengerCount) {
      const { checkVehicleCapacity } = await import('./conflictService.js');
      const capacityResult = await checkVehicleCapacity(vehicleId, job.booking.passengerCount);
      if (capacityResult.hasConflict) throw new ValidationError(capacityResult.reason || 'Vehicle capacity exceeded');
    }
  }

  if (driverId) {
    const driverConflict = await checkDriverConflict(driverId, start, end, id, current.jobId, rules);
    if (driverConflict.hasConflict) throw new ValidationError(driverConflict.reason || "Driver conflict");

    const hours = current.job.durationHours ? Number(current.job.durationHours) : 2;
    const fatigueConflict = await checkDriverFatigue(driverId, start, hours, id);
    if (fatigueConflict.hasConflict) throw new ValidationError(fatigueConflict.reason || "Fatigue conflict");
  }

  if (vehicleId) {
    const vehicleConflict = await checkVehicleConflict(vehicleId, start, end, id);
    if (vehicleConflict.hasConflict) throw new ValidationError(vehicleConflict.reason || "Vehicle conflict");
  }

  // 3. Update Assignment (Optimistic lock enforced by the WHERE clause)
  const updateData: any = {
    version: { increment: 1 } // Auto-increment version
  };
  
  if (input.driverId !== undefined) updateData.driverId = input.driverId;
  if (input.vehicleId !== undefined) updateData.vehicleId = input.vehicleId;
  if (input.scheduledStart) updateData.scheduledStart = start;
  if (input.scheduledEnd) updateData.scheduledEnd = end;
  if (input.actualStart) updateData.actualStart = new Date(input.actualStart);
  if (input.actualEnd) updateData.actualEnd = new Date(input.actualEnd);
  if (input.status) updateData.status = input.status;
  if (input.notes) updateData.notes = input.notes;

  try {
    const updatedAssignment = await prisma.$transaction(async (tx: any) => {
      const assignment = await tx.assignment.update({
        where: { 
          id, 
          version: input.version // THIS ENFORCES OPTIMISTIC LOCKING
        },
        data: updateData,
        include: { job: true, driver: true, vehicle: true },
      });

      // Adjust old driver's duty span if changed
      if (input.driverId !== undefined && current.driverId && current.driverId !== input.driverId) {
        await adjustDriverDutySpan(tx, current.driverId, start);
      }

      // Adjust new/current driver's duty span
      const finalDriverId = input.driverId !== undefined ? input.driverId : current.driverId;
      if (finalDriverId) {
        await adjustDriverDutySpan(tx, finalDriverId, start);
      }

      return assignment;
    });

    eventBus.publish(EventTypes.ASSIGNMENT_UPDATED, updatedAssignment, meta);
    return updatedAssignment;

  } catch (error: any) {
    if (error.code === 'P2025') {
       throw new ValidationError("Assignment has been modified by another user. Please refresh and try again.");
    }
    throw error;
  }
}

export async function deleteAssignment(id: number, meta?: { userId?: number | undefined }) {
  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) return { success: true, id };

  await prisma.$transaction(async (tx: any) => {
    // Delete assignment
    await tx.assignment.delete({ where: { id } });

    // Adjust driver's duty span
    if (assignment.driverId) {
      await adjustDriverDutySpan(tx, assignment.driverId, new Date(assignment.scheduledStart));
    }

    // Check if the Job has any other active assignments. If not, revert Job to UNASSIGNED.
    const otherAssignments = await tx.assignment.count({
      where: { 
        jobId: assignment.jobId,
        id: { not: id },
        status: { notIn: ["CANCELLED"] }
      }
    });

    if (otherAssignments === 0) {
      await tx.job.update({
        where: { id: assignment.jobId },
        data: { status: "UNASSIGNED" }
      });
    }
  });

  eventBus.publish(EventTypes.ASSIGNMENT_CANCELLED, { assignmentId: id, jobId: assignment.jobId }, meta);
  return { success: true, id };
}
