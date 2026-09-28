// Authorized development database only. Every fixture and workflow event is rolled back.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import { dashboardOverview } from "../services/dashboardService.js";
import { changeRecordLifecycle, deletionEligibility } from "../services/recordLifecycle.js";
const rollback = new Error("ROLLBACK_OPERATIONS_QA"), key = randomUUID();
let checks = 0;
try {
  await prisma.$transaction(async (tx: any) => {
    const nested = { $transaction: (fn: any) => fn(tx) };
    const before = await dashboardOverview("2035-06-12", nested);
    const employee = await tx.user.create({ data: { email: `${key}@example.test`, firstName: "QA", role: "DRIVER", status: "ACTIVE", skills: [] } });
    const customer = await tx.customer.create({ data: { email: `${key}-customer@example.test`, name: "QA", isActive: true } });
    const vehicle = await tx.fleetVehicle.create({ data: { make: "QA", model: "QA", year: 2030, licensePlate: key, vin: key, status: "ACTIVE" } });
    const booking = await tx.booking.create({ data: { customerId: customer.id, subject: "QA", status: "CONFIRMED", startDateTime: new Date("2035-06-12T00:00:00Z"), endDateTime: new Date("2035-06-12T02:00:00Z"), startLocation: "QA start", endLocation: "QA end", noOfVehicles: 2 } });
    const job = await tx.job.create({ data: { bookingId: booking.id, status: "ASSIGNED", jobStartDateTime: booking.startDateTime, jobEndDateTime: booking.endDateTime } });
    const allocation = await tx.assignment.create({ data: { jobId: job.id, driverId: employee.id, vehicleId: vehicle.id, status: "CONFIRMED", scheduledStart: booking.startDateTime, scheduledEnd: booking.endDateTime } });
    const after = await dashboardOverview("2035-06-12", nested);
    assert.equal(after.metrics.confirmedTripLegs, before.metrics.confirmedTripLegs + 1); assert.equal(after.metrics.jobsNeedingAllocation, before.metrics.jobsNeedingAllocation + 1); assert.equal(after.metrics.activeCustomers, before.metrics.activeCustomers + 1); assert.equal(after.metrics.activeEmployees, before.metrics.activeEmployees + 1); assert.equal(after.schedule.find((j: any) => j.id === job.id)?.status, "PARTIALLY_ASSIGNED"); checks += 5;
    for (const [resource, id] of [["users", employee.id], ["fleet", vehicle.id]] as const) { await assert.rejects(changeRecordLifecycle(resource, id, false, nested), (e: any) => e.status === 409); checks++; }
    await tx.assignment.update({ where: { id: allocation.id }, data: { status: "CANCELLED" } });
    await changeRecordLifecycle("users", employee.id, false, nested); await changeRecordLifecycle("fleet", vehicle.id, false, nested); await changeRecordLifecycle("customers", customer.id, false, nested);
    for (const [resource, id] of [["users", employee.id], ["fleet", vehicle.id], ["customers", customer.id], ["bookings", booking.id]] as const) { assert.equal((await deletionEligibility(resource, id, tx)).eligible, false); await assert.rejects(changeRecordLifecycle(resource, id, true, nested), (e: any) => e.status === 409); checks += 2; }
    const unusedEmployee = await tx.user.create({ data: { email: `${key}-unused@example.test`, status: "INACTIVE", skills: [] } });
    await changeRecordLifecycle("users", unusedEmployee.id, true, nested); assert.equal(await tx.user.findUnique({ where: { id: unusedEmployee.id } }), null); checks++;
    await assert.rejects(changeRecordLifecycle("users", unusedEmployee.id, true, nested), (e: any) => e.status === 404); checks++;
    throw rollback;
  }, { timeout: 60000 });
} catch (e) { if (e !== rollback) { console.error(e); process.exitCode = 1; } else console.log(`PASS: ${checks} database-backed dashboard/lifecycle checks. All fixtures rolled back.`); }
finally { await prisma.$disconnect(); }
