import { describe, it, expect, vi } from "vitest";
import { getAllUsers, getUserById, createUser, updateUser } from "../services/userService.js";
import { updateCustomer } from "../services/customerService.js";
import { updateVehicle } from "../services/fleetService.js";
import { bookingData } from "../services/bookingWorkflow.js";
import { bookingDispatchStatus } from "../services/bookingDispatchStatus.js";
import { updateUserSchema } from "../validators/userSchema.js";
import { updateVehicleSchema } from "../validators/fleetSchema.js";

describe("Record response and update contracts", () => {
  const user = { id: 9, firstName: "Casey", lastName: "Test", email: "test@example.test", createdAt: new Date(), profile: { id: 90, userId: 9, phoneNumber1: "0400000000", driverLicense: "ABC", dateOfBirth: new Date("1990-01-01") } };
  it("returns the same flattened employee profile from list, detail, create and update", async () => {
    const db = { user: { findMany: vi.fn().mockResolvedValue([user]), findUnique: vi.fn().mockResolvedValue(user), create: vi.fn().mockResolvedValue(user), update: vi.fn().mockResolvedValue(user) } };
    const results = [(await getAllUsers(undefined, db))[0], await getUserById(9, db), await createUser({ email: user.email, employeeNumber: "TEST-9" }, db), await updateUser(9, {}, db)];
    for (const result of results) expect(result).toMatchObject({ id: 9, name: "Casey Test", phoneNumber1: "0400000000", driverLicense: "ABC", profile: user.profile });
  });
  it("clears employee profile values and dates while preserving zero pay", async () => {
    const db = { user: { update: vi.fn().mockResolvedValue(user) } };
    await updateUser(9, updateUserSchema.parse({ phoneNumber1: "", driverLicense: "", hireDate: "", hourlyRate: 0 }), db);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ hireDate: null, hourlyRate: 0, terminationDate: undefined, profile: { upsert: { create: { phoneNumber1: "", driverLicense: "" }, update: { phoneNumber1: "", driverLicense: "" } } } }) }));
  });
  it("accepts explicit null pay, capacity and unassigned fleet relationships", () => {
    expect(updateUserSchema.parse({ hourlyRate: null }).hourlyRate).toBeNull();
    expect(updateVehicleSchema.parse({ homeDepotId: null, assignedDriverId: null, maxPassengers: null }).homeDepotId).toBeNull();
  });
  it("retains false customer flags and empty billing notes", async () => {
    const db = { customer: { update: vi.fn().mockResolvedValue({ id: 1, isActive: false, isVip: false, internalNotes: "" }) } };
    const result = await updateCustomer(1, { isActive: false, isVip: false, internalNotes: "" }, db);
    expect(result.status).toBe("Inactive");
    expect(db.customer.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false, isVip: false, internalNotes: "", phone1: undefined }) }));
  });
  it("clears fleet links and preserves zero cargo capacity", async () => {
    const db = { fleetVehicle: { update: vi.fn().mockResolvedValue({ id: 1 }) } };
    await updateVehicle(1, { homeDepotId: null, assignedDriverId: null, maxCargoVolume: 0, regoState: "" }, db);
    expect(db.fleetVehicle.update).toHaveBeenCalledWith(expect.objectContaining({ data: { homeDepotId: null, assignedDriverId: null, maxCargoVolume: 0, regoState: "" }, include: expect.objectContaining({ homeDepot: true }) }));
  });
  it("removes stale booking coordinates after manual address edits", () => {
    const existing = { startDateTime: new Date("2030-01-01T00:00Z"), endDateTime: new Date("2030-01-01T01:00Z"), timeZone: "Australia/Sydney", pickupLat: -33, pickupLng: 151, pickupPlaceId: "old" };
    expect(bookingData({ pickupLocation: "New address", pickupLat: null, pickupLng: null, pickupPlaceId: null }, existing)).toMatchObject({ pickupLat: null, pickupLng: null, pickupPlaceId: null });
    expect(bookingData({}, existing).pickupLat).toBe(-33);
  });
});
describe("Booking dispatch status", () => {
  it.each([['DRAFT','NOT_READY'],['CANCELLED','CANCELLED'],['CONFIRMED','UNASSIGNED']])("maps %s", (status, expected) => expect(bookingDispatchStatus({ status, jobs: [] })).toBe(expected));
  it("does not count cancelled jobs or cancelled allocations", () => expect(bookingDispatchStatus({ status: "CONFIRMED", jobs: [{ status: "CANCELLED", assignments: [{}] }, { status: "UNASSIGNED", assignments: [{ status: "CANCELLED" }] }] })).toBe("UNASSIGNED"));
  it("keeps a multi-vehicle booking partially assigned until each leg is covered", () => expect(bookingDispatchStatus({ status: "CONFIRMED", noOfVehicles: 2, jobs: [{ assignments: [{ status: "CONFIRMED" }] }] })).toBe("PARTIALLY_ASSIGNED"));
  it("distinguishes assigned and completed", () => {
    expect(bookingDispatchStatus({ status: "CONFIRMED", jobs: [{ assignments: [{ status: "CONFIRMED" }] }] })).toBe("ASSIGNED");
    expect(bookingDispatchStatus({ status: "CONFIRMED", jobs: [{ assignments: [{ status: "COMPLETED" }] }] })).toBe("COMPLETED");
  });
});
