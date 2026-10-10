import { prisma } from "../db.js";
import { businessTimeZone, dayWindow, localDate } from "./businessTime.js";
import { getCharterPricingConfig } from "./charterPricingService.js";

import { formatInTimeZone } from "date-fns-tz";
import { WorkflowError } from "./workflowError.js";

export interface DriverTimesheetRecord {
  id: number;
  jobId: number;
  bookingReference: string;
  customerName: string;
  routeDescription: string;
  serviceType: string;
  driverId: number;
  driverName: string;
  driverEmployeeNumber: string;
  vehicleId: number | null;
  vehiclePlate: string;
  vehicleType: "Coach" | "Bus" | "Unassigned";
  date: string;
  dayType: "Weekday" | "Weekend";
  jobStartTime: string;
  jobEndTime: string;
  jobHours: number;
  wageTierHours: number;
  timeBasis: "ACTUAL" | "SCHEDULED";
  assignmentStatus: string;
  canApprove: boolean;
  hourlyRate: number;
  totalWageAmount: number;
  status: "PENDING_REVIEW" | "APPROVED";
  supervisorNotes?: string;
  approvedBy?: string | undefined;
  approvedAt?: string | undefined;
}

export interface TimesheetSummaryStats {
  activeDriversCount: number;
  totalJobHours: number;
  totalWageCost: number;
  pendingApprovalsCount: number;
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function formatTime(d: Date): string {
  return formatInTimeZone(d, businessTimeZone(), "HH:mm");
}

/**
 * Fetch assigned job timesheets for a given date.
 * Strictly extracts real job start & end times, assigned vehicles, and calculates award wages.
 */
export async function getDriverTimesheets(dateStr?: string): Promise<{
  records: DriverTimesheetRecord[];
  summary: TimesheetSummaryStats;
}> {
  const targetDateStr = dateStr || localDate(new Date());
  const window = dayWindow(targetDateStr);
  const config = await getCharterPricingConfig();

  // Determine weekday vs weekend
  const d = new Date(`${targetDateStr}T12:00:00Z`);
  const dayOfWeek = d.getUTCDay();
  const dayType: "Weekday" | "Weekend" = dayOfWeek === 0 || dayOfWeek === 6 ? "Weekend" : "Weekday";

  // Query actual assignments
  const assignments = await prisma.assignment.findMany({
    where: {
      status: { not: "CANCELLED" },
      OR: [
        { actualStart: { gte: window.start, lt: window.end } },
        { actualStart: null, scheduledStart: { gte: window.start, lt: window.end } },
      ],
    },
    include: {
      driver: {
        include: { profile: true },
      },
      vehicle: true,
      job: {
        include: {
          booking: {
            include: { customer: true },
          },
        },
      },
    },
    orderBy: { scheduledStart: "asc" },
  });

  const approvals = await prisma.activityLog.findMany({
    where: {
      entity: "Assignment",
      action: "TIMESHEET_APPROVED",
      entityId: { in: assignments.map((a: any) => a.id) },
    },
    orderBy: { timestamp: "desc" },
  });
  const records: DriverTimesheetRecord[] = [];

  for (const assign of assignments) {
    const confirmedActual = Boolean(
      assign.actualStart && assign.actualEnd && assign.actualEnd > assign.actualStart,
    );
    const sStart = confirmedActual ? assign.actualStart! : assign.scheduledStart;
    const sEnd = confirmedActual ? assign.actualEnd! : assign.scheduledEnd || sStart;
    const durationHours = Math.max(0, (sEnd.getTime() - sStart.getTime()) / 3600000);
    const jobHours = round2(durationHours);
    // Use the configured duration tier; do not invent fallback payroll rates.
    const tiers = [...config.driverWages]
      .filter((w) => w.hours > 0)
      .sort((a, b) => a.hours - b.hours);
    const wageTier =
      tiers.find((w) => w.hours >= Math.round(durationHours)) || tiers[tiers.length - 1];
    if (!wageTier)
      throw new WorkflowError("Configure driver wage tiers before calculating timesheets");
    const wageTierHours = wageTier.hours;
    const baseWageAmount = dayType === "Weekend" ? wageTier.weekendRate : wageTier.weekdayRate;
    const hourlyRate = round2(baseWageAmount / wageTierHours);
    const totalWageAmount = round2(durationHours * hourlyRate);

    const driverName = assign.driver
      ? `${assign.driver.firstName || ""} ${assign.driver.lastName || ""}`.trim() ||
        assign.driver.email
      : "Unassigned Driver";

    const customerName = assign.job?.booking?.customer?.name || "Private Customer";
    const bookingRef = assign.job?.bookingId ? `BK-${assign.job.bookingId}` : `JOB-${assign.jobId}`;
    const route = `${assign.job?.jobStartLocation || "Depot"} → ${assign.job?.jobEndLocation || "Venue"}`;

    const approval =
      confirmedActual && assign.status === "COMPLETED"
        ? approvals.find((a: any) => {
            const snapshot = a.changes as any;
            return (
              a.entityId === assign.id &&
              snapshot?.actualStart === assign.actualStart!.toISOString() &&
              snapshot?.actualEnd === assign.actualEnd!.toISOString() &&
              snapshot?.assignmentVersion === assign.version
            );
          })
        : undefined;
    const isApproved = Boolean(approval);

    records.push({
      id: assign.id,
      jobId: assign.jobId,
      bookingReference: bookingRef,
      customerName,
      routeDescription: route,
      serviceType: (assign.job?.booking?.bookingType || "CHARTER").replaceAll("_", " "),
      driverId: assign.driverId || 0,
      driverName,
      driverEmployeeNumber:
        assign.driver?.profile?.employeeNumber ||
        (assign.driverId ? `EMP-${assign.driverId}` : "—"),
      vehicleId: assign.vehicleId,
      vehiclePlate: assign.vehicle?.licensePlate || "Pending Depot Allocation",
      vehicleType: !assign.vehicle
        ? "Unassigned"
        : assign.vehicle.facilities?.includes("Bus")
          ? "Bus"
          : assign.vehicle.facilities?.includes("Coach")
            ? "Coach"
            : assign.vehicle.maxPassengers && assign.vehicle.maxPassengers <= 28
              ? "Bus"
              : "Coach",
      date: targetDateStr,
      dayType,
      jobStartTime: formatTime(sStart),
      jobEndTime: formatTime(sEnd),
      jobHours,
      wageTierHours,
      timeBasis: confirmedActual ? "ACTUAL" : "SCHEDULED",
      assignmentStatus: assign.status,
      canApprove: assign.status === "COMPLETED" && confirmedActual && !isApproved,
      approvedBy: approval ? String((approval.changes as any)?.supervisorName || "") : undefined,
      approvedAt: approval?.timestamp.toISOString(),
      hourlyRate,
      totalWageAmount,
      status: isApproved ? "APPROVED" : "PENDING_REVIEW",
      supervisorNotes: assign.notes || undefined,
    });
  }

  // Aggregate summary
  const activeDriversCount = new Set(records.map((r) => r.driverId).filter(Boolean)).size;
  const totalJobHours = round2(records.reduce((acc, r) => acc + r.jobHours, 0));
  const totalWageCost = round2(records.reduce((acc, r) => acc + r.totalWageAmount, 0));
  const pendingApprovalsCount = records.filter((r) => r.status === "PENDING_REVIEW").length;

  return {
    records,
    summary: {
      activeDriversCount,
      totalJobHours,
      totalWageCost,
      pendingApprovalsCount,
    },
  };
}

/**
 * Approve a driver's timesheet for a completed job.
 */
export async function approveDriverTimesheet(
  assignmentId: number,
  supervisorName: string,
): Promise<{ success: boolean; id: number; status: string }> {
  if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0)
    throw new WorkflowError("Invalid assignment");
  return prisma.$transaction(
    async (tx: any) => {
      const assignment = await tx.assignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw new WorkflowError("Assignment not found", 404);
      if (
        assignment.status !== "COMPLETED" ||
        !assignment.actualStart ||
        !assignment.actualEnd ||
        assignment.actualEnd <= assignment.actualStart
      )
        throw new WorkflowError(
          "Only completed jobs with confirmed actual start and end times can be approved",
          409,
        );
      await tx.activityLog.create({
        data: {
          entity: "Assignment",
          entityId: assignmentId,
          action: "TIMESHEET_APPROVED",
          changes: {
            supervisorName: String(supervisorName),
            actualStart: assignment.actualStart.toISOString(),
            actualEnd: assignment.actualEnd.toISOString(),
            assignmentVersion: assignment.version,
          },
        },
      });
      return { success: true, id: assignmentId, status: "APPROVED" };
    },
    { isolationLevel: "Serializable" },
  );
}
