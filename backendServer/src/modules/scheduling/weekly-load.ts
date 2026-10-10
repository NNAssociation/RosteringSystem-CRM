import { endOfWeek, startOfWeek } from "date-fns";
import { prisma } from "../../db.js";
import type { DriverLoad } from "./types.js";

export async function getDriverWeeklyLoad(driverId: number, targetDate: Date): Promise<DriverLoad> {
  const startOfTargetWeek = startOfWeek(targetDate, { weekStartsOn: 1 });
  const endOfTargetWeek = endOfWeek(targetDate, { weekStartsOn: 1 });

  const weeklyAssignments = await prisma.assignment.findMany({
    where: {
      driverId,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      scheduledStart: { gte: startOfTargetWeek, lte: endOfTargetWeek },
    },
    include: { job: true },
  });

  let weeklyHours = 0;
  let weeklyEarnings = 0;

  for (const a of weeklyAssignments) {
    const hours = a.job?.durationHours ? Number(a.job.durationHours) : 2;
    weeklyHours += hours;

    const dayOfWeek = new Date(a.scheduledStart).getDay();
    if (dayOfWeek === 0) {
      weeklyEarnings += hours * 60;
    } else if (dayOfWeek === 6) {
      weeklyEarnings += hours * 45;
    } else {
      weeklyEarnings += hours * 30;
    }
  }

  return { driverId, weeklyHours, weeklyEarnings };
}
