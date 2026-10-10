import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { isOffice, requireEmployee } from "../middleware/employeeAuth.js";
import { featureGate } from "../middleware/featureFlag.js";
import { updateAssignment } from "../services/assignmentService.js";
import { businessTimeZone, dayWindow, localDate } from "../services/businessTime.js";

export const yardRouter = Router();
yardRouter.use(
  requireEmployee,
  (req, res, next) => {
    const employee = (req as any).employee;
    if (!isOffice(employee) && employee.role !== "YARD") {
      res.status(403).json({ error: "Yard or office staff access is required" });
      return;
    }
    next();
  },
  featureGate("DISPATCH_ENABLED"),
);

yardRouter.get("/board", async (req, res, next) => {
  try {
    const date = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(req.query.date || localDate(new Date()));
    const { start, end } = dayWindow(date);
    const [assignments, vehicles] = await Promise.all([
      prisma.assignment.findMany({
        where: {
          status: { not: "CANCELLED" },
          job: { booking: { status: "CONFIRMED" } },
          scheduledStart: { lt: end },
          scheduledEnd: { gt: start },
        },
        select: {
          id: true,
          jobId: true,
          driverId: true,
          vehicleId: true,
          status: true,
          scheduledStart: true,
          scheduledEnd: true,
          version: true,
          driver: { select: { id: true, firstName: true, lastName: true, email: true } },
          vehicle: true,
          job: {
            select: {
              id: true,
              jobStartLocation: true,
              jobEndLocation: true,
              booking: {
                select: {
                  passengerCount: true,
                  bookingType: true,
                  customer: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { scheduledStart: "asc" },
      }),
      prisma.fleetVehicle.findMany({
        where: { status: { not: "INACTIVE" } },
        orderBy: { licensePlate: "asc" },
      }),
    ]);
    res.json({ assignments, vehicles, timeZone: businessTimeZone() });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: "Select a valid yard date" });
      return;
    }
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

// Yard staff can change the bus only; driver, schedule and status remain dispatch-owned.
const allocationInput = z
  .object({
    vehicleId: z.number().int().positive().nullable(),
    version: z.number().int().positive(),
  })
  .strict();
yardRouter.patch("/assignments/:id/vehicle", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const input = allocationInput.parse(req.body);
    res.json(await updateAssignment(id, input, { userId: (req as any).employee.id }));
  } catch (error: any) {
    if (error.name === "ZodError") {
      res
        .status(400)
        .json({ error: "Provide a valid vehicle and current assignment version only" });
      return;
    }
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});
