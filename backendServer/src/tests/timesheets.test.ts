import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  assignment: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  activityLog: { findMany: vi.fn(), create: vi.fn() },
}));
vi.mock("../db.js", () => ({ prisma: db }));
vi.mock("../services/charterPricingService.js", () => ({
  getCharterPricingConfig: vi.fn().mockResolvedValue({
    driverWages: [
      { hours: 8, weekdayRate: 400, weekendRate: 480 },
      { hours: 9, weekdayRate: 540, weekendRate: 630 },
    ],
  }),
}));
const { getDriverTimesheets, approveDriverTimesheet } =
  await import("../services/timesheetService.js");
const { dateTime } = await import("../services/businessTime.js");
const assignment = () => ({
  id: 1,
  jobId: 2,
  driverId: 3,
  vehicleId: 4,
  version: 1,
  status: "COMPLETED",
  scheduledStart: dateTime("2030-01-01", "07:00"),
  scheduledEnd: dateTime("2030-01-01", "16:00"),
  actualStart: dateTime("2030-01-01", "07:30"),
  actualEnd: dateTime("2030-01-01", "08:00"),
  driver: { firstName: "Pat", lastName: "Driver", profile: {} },
  vehicle: { licensePlate: "ABC", maxPassengers: 48, facilities: ["Bus"] },
  job: { booking: {} },
});
beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  db.assignment.findMany.mockResolvedValue([assignment()]);
  db.assignment.findUnique.mockResolvedValue(assignment());
  db.activityLog.findMany.mockResolvedValue([]);
});
describe("Driver timesheets", () => {
  it("uses actual fractional hours, business-local times and the explicit vehicle type", async () => {
    const { records, summary } = await getDriverTimesheets("2030-01-01");
    expect(records[0]).toMatchObject({
      jobHours: 0.5,
      jobStartTime: "07:30",
      jobEndTime: "08:00",
      timeBasis: "ACTUAL",
      wageTierHours: 8,
      hourlyRate: 50,
      totalWageAmount: 25,
      vehicleType: "Bus",
      status: "PENDING_REVIEW",
      canApprove: true,
    });
    expect(summary.totalJobHours).toBe(0.5);
  });
  it("labels scheduled estimates and does not approve incomplete actual times", async () => {
    db.assignment.findMany.mockResolvedValue([{ ...assignment(), actualEnd: null }]);
    expect((await getDriverTimesheets("2030-01-01")).records[0]).toMatchObject({
      timeBasis: "SCHEDULED",
      canApprove: false,
      wageTierHours: 9,
    });
    db.assignment.findUnique.mockResolvedValue({ ...assignment(), actualEnd: null });
    await expect(approveDriverTimesheet(1, "Manager")).rejects.toThrow("confirmed actual");
    expect(db.activityLog.create).not.toHaveBeenCalled();
  });
  it("uses the configured weekend tier", async () => {
    expect((await getDriverTimesheets("2030-01-05")).records[0]).toMatchObject({
      dayType: "Weekend",
      hourlyRate: 60,
      totalWageAmount: 30,
    });
  });
  it("records approval without changing job completion or overwriting notes", async () => {
    await approveDriverTimesheet(1, "Manager");
    expect(db.assignment.update).not.toHaveBeenCalled();
    expect(db.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "TIMESHEET_APPROVED",
        changes: expect.objectContaining({ assignmentVersion: 1, supervisorName: "Manager" }),
      }),
    });
  });
  it("does not claim approval succeeded when the database rejects the write", async () => {
    db.activityLog.create.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(approveDriverTimesheet(1, "Manager")).rejects.toThrow("database unavailable");
  });
  it("invalidates approval after actual times or assignment version change", async () => {
    const a = assignment();
    db.activityLog.findMany.mockResolvedValue([
      {
        entityId: 1,
        timestamp: new Date(),
        changes: {
          actualStart: a.actualStart.toISOString(),
          actualEnd: a.actualEnd.toISOString(),
          assignmentVersion: 1,
        },
      },
    ]);
    expect((await getDriverTimesheets("2030-01-01")).records[0]?.status).toBe("APPROVED");
    db.assignment.findMany.mockResolvedValue([{ ...a, version: 2 }]);
    expect((await getDriverTimesheets("2030-01-01")).records[0]?.status).toBe("PENDING_REVIEW");
  });
});
