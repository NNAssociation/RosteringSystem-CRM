import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(), $executeRaw: vi.fn(), job: { findUnique: vi.fn(), update: vi.fn() }, user: { findUnique: vi.fn() }, fleetVehicle: { findUnique: vi.fn() }, dispatchLock: { findMany: vi.fn() }, driverAvailability: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() }, assignment: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, workflowEvent: { create: vi.fn() } }));
vi.mock("../db.js", () => ({ prisma: db }));
vi.mock("../services/conflictService.js", () => ({ checkDriverConflict: vi.fn().mockResolvedValue({ hasConflict: false }), checkVehicleConflict: vi.fn().mockResolvedValue({ hasConflict: false }), checkDriverFatigue: vi.fn().mockResolvedValue({ hasConflict: false }) }));
vi.mock("../services/settingsService.js", () => ({ getSchedulingRules: vi.fn().mockResolvedValue({}) }));
vi.mock("../services/googleMapsService.js", () => ({ getTravelTime: vi.fn().mockResolvedValue({ durationMinutes: 15 }), DEPOT_LOCATION: { lat: 1, lng: 1, address: "Depot" } }));
const { createAssignment, deleteAssignment, assertTripTimes, cancelBookingAssignments } = await import("../services/assignmentService.js");
const job = () => ({ id: 1, status: "UNASSIGNED", booking: { status: "CONFIRMED", noOfVehicles: 2, passengerCount: 50 }, jobStartDateTime: new Date("2030-01-01T00:00Z"), jobEndDateTime: new Date("2030-01-01T01:00Z"), assignments: [] });
const input = { jobId: 1, driverId: 1, vehicleId: 1, scheduledStart: "2030-01-01T00:00Z", scheduledEnd: "2030-01-01T01:00Z" };
beforeEach(() => { vi.clearAllMocks(); db.$transaction.mockImplementation(fn => fn(db)); db.job.findUnique.mockResolvedValue(job()); db.user.findUnique.mockResolvedValue({ id: 1, role: "DRIVER", status: "ACTIVE" }); db.fleetVehicle.findUnique.mockResolvedValue({ id: 1, maxPassengers: 25 }); db.dispatchLock.findMany.mockResolvedValue([]); db.driverAvailability.findMany.mockResolvedValue([]); db.assignment.findMany.mockResolvedValue([]); db.assignment.create.mockResolvedValue({ id: 2 }); });
describe("Dispatch allocation rules", () => {
  it("clears calculated duty after booking cancellation without deleting manual availability", async () => {
    const updateMany = vi.fn();
    db.assignment.findMany.mockResolvedValueOnce([{ driverId: 1, scheduledStart: new Date(input.scheduledStart) }]).mockResolvedValue([]);
    await cancelBookingAssignments({ ...db, assignment: { ...db.assignment, updateMany } }, 1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELLED", version: { increment: 1 } } }));
    expect(db.driverAvailability.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ source: "CALCULATED", driverId: 1 }) }));
    expect(db.driverAvailability.create).not.toHaveBeenCalled();
  });
  it("rejects dispatch before customer confirmation", async () => { db.job.findUnique.mockResolvedValue({ ...job(), booking: { status: "DRAFT" } }); await expect(createAssignment(input)).rejects.toThrow("confirmed"); expect(db.assignment.create).not.toHaveBeenCalled(); });
  it("permits the first vehicle in a multi-vehicle allocation", async () => { await createAssignment(input); expect(db.assignment.create).toHaveBeenCalledTimes(1); });
  it("rejects the last allocation if combined capacity is insufficient", async () => { db.job.findUnique.mockResolvedValue({ ...job(), assignments: [{ driverId: 2, vehicleId: 2, vehicle: { maxPassengers: 20 } }] }); await expect(createAssignment(input)).rejects.toThrow("capacity"); });
  it("does not allocate more vehicle slots than requested", async () => { db.job.findUnique.mockResolvedValue({ ...job(), assignments: [{}, {}] }); await expect(createAssignment(input)).rejects.toThrow("already assigned"); });
  it("rejects a resource locked by another dispatcher", async () => { db.dispatchLock.findMany.mockResolvedValue([{ lockedBy: 99 }]); await expect(createAssignment(input, { userId: 1 })).rejects.toThrow("locked"); });
  it("rejects inactive drivers and missing vehicles", async () => { db.user.findUnique.mockResolvedValue({ role: "DRIVER", status: "ON_LEAVE" }); await expect(createAssignment(input)).rejects.toThrow("Driver"); await expect(createAssignment({ ...input, vehicleId: undefined })).rejects.toThrow("both"); });
  it("preserves confirmed times rather than silently changing dates", () => expect(() => assertTripTimes(job(), new Date("2030-01-02T00:00Z"), new Date("2030-01-02T01:00Z"))).toThrow("preserve"));
  it("requires the current version before unassignment", async () => { db.assignment.findUnique.mockResolvedValue({ id: 1, status: "CONFIRMED", version: 2 }); await expect(deleteAssignment(1, {}, 1)).rejects.toThrow("changed"); expect(db.assignment.update).not.toHaveBeenCalled(); });
  it("cannot unassign an in-progress trip", async () => { db.assignment.findUnique.mockResolvedValue({ id: 1, status: "IN_PROGRESS", version: 2 }); await expect(deleteAssignment(1, {}, 2)).rejects.toThrow("Started"); });
});
