// Run only against the authorized development database. All fixture writes roll back.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import * as employees from "../services/userService.js";
import * as customers from "../services/customerService.js";
import * as fleet from "../services/fleetService.js";
import * as bookings from "../services/bookingService.js";
import { createBookingSchema } from "../validators/bookingSchema.js";
const rollback = new Error("ROLLBACK_VERIFICATION");
const suffix = randomUUID();
let checked = 0;
try {
  await prisma.$transaction(async (tx: any) => {
    const employee = await employees.createUser({ email: `qa-${suffix}@example.test`, employeeNumber: `QA-${suffix}`, firstName: "Test", lastName: "Employee", phoneNumber1: "0400000000", phoneNumber2: "0400000001", driverLicense: "TEST", driverLicenseState: "NSW", driverLicenseExpiry: "2030-01-01", role: "DRIVER", status: "ACTIVE", employmentType: "CONTRACT", address: "Test address", emergencyContactName: "Test Contact", emergencyContactPhone: "0400000002", emergencyContactRelation: "Other", hireDate: "2026-01-01", hourlyRate: 35, hrNotes: "Test notes" }, tx);
    let loaded = await employees.getUserById(employee.id, tx);
    for (const field of ["firstName","lastName","email","phoneNumber1","phoneNumber2","driverLicense","driverLicenseState","emergencyContactName","emergencyContactPhone","emergencyContactRelation","hrNotes","role","employmentType"]) { assert.equal(loaded[field], employee[field]); checked++; }
    await employees.updateUser(employee.id, { firstName: "Updated", phoneNumber1: "", driverLicense: "", driverLicenseExpiry: "", hireDate: "", hourlyRate: 0, hrNotes: "Updated HR" }, tx);
    loaded = await employees.getUserById(employee.id, tx);
    assert.equal(loaded.firstName, "Updated"); assert.equal(loaded.phoneNumber1, ""); assert.equal(loaded.driverLicense, ""); assert.equal(loaded.driverLicenseExpiry, null); assert.equal(loaded.hireDate, null); assert.equal(Number(loaded.hourlyRate), 0); checked += 6;
    const customer = await customers.createCustomer({ email: `customer-${suffix}@example.test`, name: "Test Customer", phone1: "0400000000", phone2: "0400000001", company: "Test Company", address: "Test address", customerType: "CORPORATE", contactName: "Test Contact", contactRole: "Manager", taxId: "TEST", preferredPaymentMethod: "INVOICE", paymentTerms: "NET_30", internalNotes: "Test billing notes", isVip: true, accountStanding: "GOOD" }, tx);
    let c = await customers.getCustomerById(customer.id, tx);
    for (const field of ["email","name","phone1","phone2","company","address","customerType","contactName","contactRole","taxId","preferredPaymentMethod","paymentTerms","internalNotes","isVip","accountStanding"]) { assert.equal(c[field], customer[field]); checked++; }
    await customers.updateCustomer(customer.id, { isVip: false, internalNotes: "", phone2: "", paymentTerms: "NET_60" }, tx);
    c = await customers.getCustomerById(customer.id, tx);
    assert.equal(c.isVip, false); assert.equal(c.internalNotes, ""); assert.equal(c.phone2, ""); assert.equal(c.paymentTerms, "NET_60"); checked += 4;
    const depot = await tx.depot.findFirst();
    const vehicle = await fleet.createVehicle({ make: "Test", model: "Test", year: 2026, licensePlate: `QA-${suffix}`, vin: `QA-${suffix}`, regoState: "NSW", status: "ACTIVE", maxPassengers: 12, maxCargoVolume: 1.5, assignedDriverId: employee.id, ...(depot ? { homeDepotId: depot.id } : {}) }, tx);
    assert.equal(vehicle.assignedDriver.id, employee.id); checked++;
    await fleet.updateVehicle(vehicle.id, { assignedDriverId: null, homeDepotId: null, maxPassengers: 0, maxCargoVolume: 0, regoState: "" }, tx);
    const v = await fleet.getVehicleById(vehicle.id, tx);
    assert.equal(v.assignedDriver, null); assert.equal(v.homeDepot, null); assert.equal(v.maxPassengers, 0); assert.equal(Number(v.maxCargoVolume), 0); assert.equal(v.regoState, ""); checked += 5;
    const bookingDb = { $transaction: (fn: (tx: any) => Promise<any>) => fn(tx) };
    const booking = await bookings.createBooking(createBookingSchema.parse({
      customerId: customer.id, customerEmail: customer.email, subject: "QA journey", service: "Charter",
      pickupLocation: "Sydney Airport", dropoffLocation: "Sydney Central", date: "2026-10-10", startTime: "09:00", endTime: "11:00",
      timeZone: "Australia/Sydney", passengerCount: 10, noOfVehicles: 2, bookingDetails: "QA notes",
      pickupLat: -33.94, pickupLng: 151.17, pickupPlaceId: "test-place", stops: [{ address: "Test stop", lat: -33.9, lng: 151.2 }],
    }), undefined, bookingDb);
    let b = await bookings.getBookingById(booking.id, tx);
    for (const field of ["customerId", "customerName", "subject", "service", "pickupLocation", "dropoffLocation", "date", "passengerCount", "noOfVehicles", "bookingDetails", "pickupLat", "pickupLng", "pickupPlaceId", "timeZone"]) { assert.deepEqual(b[field], booking[field]); checked++; }
    assert.deepEqual(b.stops, [{ address: "Test stop", lat: -33.9, lng: 151.2 }]); checked++;
    await bookings.updateBooking(booking.id, { revision: booking.revision, subject: "Updated journey", bookingDetails: "", passengerCount: 0, pickupLocation: "Manual pickup", pickupLat: null, pickupLng: null, pickupPlaceId: null, stops: [] }, undefined, bookingDb);
    b = await bookings.getBookingById(booking.id, tx);
    assert.equal(b.subject, "Updated journey"); assert.equal(b.bookingDetails, ""); assert.equal(b.passengerCount, 0); assert.equal(b.pickupLat, null); assert.equal(b.pickupLng, null); assert.equal(b.pickupPlaceId, null); assert.deepEqual(b.stops, []); assert.equal(b.status, "DRAFT"); assert.equal(b.dispatchStatus, "NOT_READY"); assert.equal(b.jobs.length, 0); checked += 10;
    throw rollback;
  }, { timeout: 60000 });
} catch (error) { if (error !== rollback) { console.error(error); process.exitCode = 1; } else console.log(`PASS: ${checked} persisted-field checks; transaction rolled back, no test records retained.`); }
finally { await prisma.$disconnect(); }
