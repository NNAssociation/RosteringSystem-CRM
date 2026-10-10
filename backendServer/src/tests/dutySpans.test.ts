import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  assignment: { findMany: vi.fn() },
  driverAvailability: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  workflowEvent: { create: vi.fn() },
}));
vi.mock("../db.js", () => ({ prisma: db }));
vi.mock("../services/userService.js", () => ({ getDriversForDispatch: vi.fn() }));
vi.mock("../services/fleetService.js", () => ({ getAvailableVehicles: vi.fn() }));
const { setDutySpan } = await import("../services/dispatchService.js");
const { dateTime } = await import("../services/businessTime.js");
const date = dateTime("2030-01-01", "12:00");
const span = (start: string, end: string, endDate = "2030-01-01") => ({
  startTime: dateTime("2030-01-01", start),
  endTime: dateTime(endDate, end),
});
beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  db.assignment.findMany.mockResolvedValue([]);
  db.driverAvailability.findMany.mockResolvedValue([]);
  db.driverAvailability.create.mockImplementation(async ({ data }) => data);
});
describe("Split duty availability", () => {
  it("atomically replaces each driver's manual availability with every span", async () => {
    const result = await setDutySpan([1, 2, 1], date, [
      span("06:30", "09:30"),
      span("14:30", "18:30"),
    ]);
    expect(result).toHaveLength(4);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.driverAvailability.deleteMany).toHaveBeenCalledTimes(2);
    expect(db.driverAvailability.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ source: "MANUAL", isBlocked: false, dayOfWeek: null }),
    });
  });
  it("rejects overlapping spans before deleting availability", async () => {
    await expect(
      setDutySpan([1], date, [span("06:30", "15:00"), span("14:30", "18:30")]),
    ).rejects.toThrow("overlap");
    expect(db.driverAvailability.deleteMany).not.toHaveBeenCalled();
  });
  it("rejects an existing job in the gap between split shifts", async () => {
    db.assignment.findMany.mockResolvedValue([
      {
        scheduledStart: dateTime("2030-01-01", "11:00"),
        scheduledEnd: dateTime("2030-01-01", "12:00"),
      },
    ]);
    await expect(
      setDutySpan([1], date, [span("06:30", "09:30"), span("14:30", "18:30")]),
    ).rejects.toThrow("Existing assignments");
    expect(db.driverAvailability.deleteMany).not.toHaveBeenCalled();
  });
  it("accepts an overnight shift and preserves legacy callers", async () => {
    const overnight = span("22:00", "02:00", "2030-01-02");
    await expect(
      setDutySpan([1], date, overnight.startTime, overnight.endTime),
    ).resolves.toHaveLength(1);
  });
  it("rejects overlap with an adjacent day's manual shift", async () => {
    db.driverAvailability.findMany.mockResolvedValue([
      { startTime: dateTime("2030-01-02", "01:00"), endTime: dateTime("2030-01-02", "03:00") },
    ]);
    await expect(setDutySpan([1], date, [span("22:00", "02:00", "2030-01-02")])).rejects.toThrow(
      "another day",
    );
  });
  it("rejects empty, invalid and zero-length windows", async () => {
    await expect(setDutySpan([1], date, [])).rejects.toThrow("Invalid duty");
    await expect(setDutySpan([1], date, [span("09:00", "09:00")])).rejects.toThrow("Invalid duty");
    await expect(setDutySpan([0], date, [span("09:00", "10:00")])).rejects.toThrow("driver");
  });
});

it("accepts Mechanics / Yard notice audiences", async () => {
  const { noticeInput } = await import("../services/noticeService.js");
  expect(
    noticeInput.parse({
      title: "Yard update",
      body: "Inspection change",
      category: "OPERATIONS",
      priority: "INFORMATION",
      audience: ["MECHANIC", "YARD"],
    }).audience,
  ).toEqual(["MECHANIC", "YARD"]);
});
