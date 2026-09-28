import { describe, it, expect, vi } from "vitest";
import { summarizeOperations, dashboardOverview } from "../services/dashboardService.js";
import { assertCanDeactivate, changeRecordLifecycle, deletionEligibility } from "../services/recordLifecycle.js";
import { getAllUsers } from "../services/userService.js";
import { getAllCustomers } from "../services/customerService.js";
import { getAllVehicles } from "../services/fleetService.js";
import { dayWindow } from "../services/businessTime.js";
const now = new Date("2026-10-03T00:00:00Z"), zone = "Australia/Sydney";
const empty = () => ({ jobs: [], employees: [], customers: [], vehicles: [], quotations: [] } as any);
const job = (overrides: any = {}) => ({ id: 1, bookingId: 5, status: "ASSIGNED", booking: { status: "CONFIRMED", noOfVehicles: 2, customer: { name: "Test" } }, jobStartDateTime: "2026-10-03T13:30:00Z", jobEndDateTime: "2026-10-03T16:30:00Z", assignments: [{ id: 1, status: "CONFIRMED", vehicleId: 3, driver: { firstName: "Casey" }, vehicle: { licensePlate: "BUS" } }], ...overrides });
describe("Operations dashboard", () => {
  it("returns real zero counts for an empty day", () => { const result = summarizeOperations(empty(), "2026-10-04", zone, now); expect(result.metrics).toEqual({ confirmedTripLegs: 0, jobsNeedingAllocation: 0, activeEmployees: 0, activeCustomers: 0 }); expect(result.attention).toEqual([]); });
  it("counts an overnight trip during Sydney's 23-hour day and detects a missing vehicle", () => {
    const data = empty(); data.jobs = [job(), job({ id: 2, booking: { status: "DRAFT" } }), job({ id: 3, status: "CANCELLED" })];
    const result = summarizeOperations(data, "2026-10-04", zone, now);
    expect(result.metrics.confirmedTripLegs).toBe(1); expect(result.metrics.jobsNeedingAllocation).toBe(1); expect(result.schedule[0].status).toBe("PARTIALLY_ASSIGNED"); expect(result.fleet.scheduled).toBe(1);
    const { start, end } = dayWindow("2026-10-04", zone); expect(+end - +start).toBe(23 * 3600000);
    const longDay = dayWindow("2026-04-05", zone); expect(+longDay.end - +longDay.start).toBe(25 * 3600000);
  });
  it("ignores cancelled allocations, deduplicates vehicles and counts only active records", () => {
    const data = empty(); data.jobs = [job(), job({ id: 2, assignments: [...job().assignments, { id: 2, status: "CANCELLED", vehicleId: 4 }] })];
    data.employees = [{ status: "ACTIVE" }, { status: "INACTIVE" }, { status: "ON_LEAVE" }]; data.customers = [{ isActive: true }, { isActive: false }]; data.vehicles = [{ status: "ACTIVE" }, { status: "Maintenance" }, { status: "INACTIVE" }];
    const result = summarizeOperations(data, "2026-10-04", zone, now); expect(result.fleet).toEqual({ eligibleActive: 1, scheduled: 1, maintenance: 1, inactive: 1, total: 3 }); expect(result.metrics.activeEmployees).toBe(1); expect(result.metrics.activeCustomers).toBe(1);
  });
  it("does not request allocations for completed jobs", () => { const data = empty(); data.jobs = [job({ status: "COMPLETED", assignments: [] })]; expect(summarizeOperations(data, "2026-10-04", zone, now).metrics.jobsNeedingAllocation).toBe(0); });
  it("includes expiry, licence and delivery alerts with record links", () => {
    const data = empty(); data.employees = [{ id: 8, status: "ACTIVE", role: "DRIVER", profile: { driverLicenseExpiry: "2026-10-02T00:00:00Z" } }];
    data.quotations = [{ id: 3, bookingId: 5, status: "SENT", expiresAt: "2026-10-04T00:00:00Z", deliveries: [{ id: 7, status: "FAILED", recipient: "test@example.test" }] }, { id: 4, status: "ACCEPTED", expiresAt: "2026-10-04T00:00:00Z", deliveries: [] }];
    const result = summarizeOperations(data, "2026-10-04", zone, now); expect(result.attention.map((a: any) => a.kind).sort()).toEqual(["delivery", "licence", "quotation"]); expect(result.attention[0].href).toBe("/dashboard/employees?record=8");
  });
  it("validates a malformed date before querying", async () => { await expect(dashboardOverview("bad", {})).rejects.toMatchObject({ status: 400 }); });
});
function database(record: any) {
  const model = () => ({ findUnique: vi.fn().mockResolvedValue(record), count: vi.fn().mockResolvedValue(0), delete: vi.fn().mockResolvedValue(record), update: vi.fn().mockResolvedValue(record), create: vi.fn().mockResolvedValue({}) });
  const tx: any = { user: model(), customer: model(), fleetVehicle: model(), booking: model(), assignment: model(), driverAvailability: model(), activityLog: model(), quotation: model(), job: model(), workflowEvent: model(), $executeRaw: vi.fn(), $queryRawUnsafe: vi.fn() };
  tx.$transaction = vi.fn((fn: any) => fn(tx)); return tx;
}
describe("Record lifecycle", () => {
  it.each(["users", "customers", "fleet", "bookings"] as const)("only deletes unused inactive %s", async resource => { const db = database({ id: 1, status: resource === "bookings" ? "CANCELLED" : "INACTIVE", isActive: false }); expect((await changeRecordLifecycle(resource, 1, true, db)).success).toBe(true); expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" })); });
  it("blocks active records and never invokes deletion", async () => { const db = database({ status: "ACTIVE" }); await expect(changeRecordLifecycle("users", 1, true, db)).rejects.toMatchObject({ status: 409 }); expect(db.user.delete).not.toHaveBeenCalled(); });
  it("retains customers with booking history", async () => { const db = database({ isActive: false }); db.booking.count.mockResolvedValue(2); expect(await deletionEligibility("customers", 1, db)).toMatchObject({ eligible: false, reasons: ["2 bookings prevent permanent deletion."] }); });
  it("retains employee availability and authored history", async () => { const db = database({ status: "INACTIVE" }); db.driverAvailability.count.mockResolvedValue(1); db.activityLog.count.mockResolvedValue(3); expect((await deletionEligibility("users", 1, db)).reasons).toHaveLength(2); });
  it("retains quotation and amendment history", async () => { const db = database({ status: "CANCELLED", amendsBookingId: 9 }); db.quotation.count.mockResolvedValue(1); expect((await deletionEligibility("bookings", 1, db)).eligible).toBe(false); });
  it("rechecks dependencies inside the transaction", async () => { const db = database({ isActive: false }); expect((await deletionEligibility("customers", 1, db)).eligible).toBe(true); db.booking.count.mockResolvedValue(1); await expect(changeRecordLifecycle("customers", 1, true, db)).rejects.toMatchObject({ status: 409 }); expect(db.customer.delete).not.toHaveBeenCalled(); });
  it("requires reassignment before deactivation", async () => { const db = database({ status: "ACTIVE" }); db.assignment.count.mockResolvedValue(1); await expect(assertCanDeactivate(db, "fleet", 1)).rejects.toMatchObject({ status: 409 }); expect(db.fleetVehicle.update).not.toHaveBeenCalled(); });
  it("returns not found for already deleted records", async () => { const db = database(null); await expect(changeRecordLifecycle("users", 1, true, db)).rejects.toMatchObject({ status: 404 }); });
  it("surfaces a concurrent write as a conflict", async () => { const db = database({ isActive: false }); db.customer.delete.mockRejectedValue({ code: "P2034" }); await expect(changeRecordLifecycle("customers", 1, true, db)).rejects.toMatchObject({ status: 409 }); });
});
it("all entity lists use stable creation ordering", async () => { const model = { findMany: vi.fn().mockResolvedValue([]) }; const db = { user: model, customer: model, fleetVehicle: model }; await getAllUsers(undefined, db); await getAllCustomers(db); await getAllVehicles(db); for (const [query] of model.findMany.mock.calls) expect(query).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }); });
