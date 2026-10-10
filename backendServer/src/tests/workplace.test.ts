import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEmployee } from "../middleware/employeeAuth.js";
import {
  attachmentParent,
  authorizeAttachment,
  cleanupAttachments,
  detectFile,
  downloadAttachment,
  uploadAttachment,
} from "../services/attachmentService.js";
import { incidentAction, validateIncidentTransition } from "../services/incidentService.js";
import {
  canReadNotice,
  noticeAction,
  processNoticeSchedule,
  saveNotice,
} from "../services/noticeService.js";
import {
  matchProperty,
  propertyAction,
  propertyDetail,
  releaseMatch,
} from "../services/propertyService.js";
import { pagination, transaction, validateContext } from "../services/workplaceCommon.js";
const state = vi.hoisted(() => ({ db: null as any, identity: vi.fn() }));
vi.mock("../db.js", () => ({
  get prisma() {
    return state.db;
  },
}));
vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({ userId: req.headers["x-test-user"] }),
  clerkClient: { users: { getUser: state.identity } },
}));
const driver = { id: 1, role: "DRIVER", firstName: "Driver", lastName: "Test" },
  dispatcher = { ...driver, id: 2, role: "DISPATCHER" };
function model() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    createMany: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    upsert: vi.fn(),
    delete: vi.fn(),
  };
}
function database() {
  const db: any = {};
  for (const key of [
    "user",
    "notice",
    "noticeRevision",
    "noticeRecipient",
    "incident",
    "incidentUpdate",
    "incidentAction",
    "lostPropertyReport",
    "foundPropertyItem",
    "propertyMatch",
    "propertyCustodyEvent",
    "propertyClaimant",
    "fleetVehicle",
    "assignment",
    "booking",
    "job",
    "depot",
    "customer",
    "attachment",
    "notification",
    "activityLog",
    "workflowEvent",
  ])
    db[key] = model();
  db.$transaction = vi.fn((fn: any) => (typeof fn === "function" ? fn(db) : Promise.all(fn)));
  db.$executeRaw = vi.fn();
  return db;
}
beforeEach(() => {
  state.db = database();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.stubEnv("NOTICES_ENABLED", "true");
  vi.stubEnv("INCIDENTS_ENABLED", "true");
  vi.stubEnv("LOST_PROPERTY_ENABLED", "true");
});
describe("Employee identity", () => {
  it("uses the employee role, never Clerk metadata, for linked identities", async () => {
    state.db.user.findUnique.mockResolvedValue({ ...driver, clerkId: "clerk-1", status: "ACTIVE" });
    expect((await resolveEmployee("clerk-1")).role).toBe("DRIVER");
    expect(state.identity).not.toHaveBeenCalled();
  });
  it("links a verified primary email exactly once", async () => {
    state.db.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...driver, clerkId: null, status: "ACTIVE" });
    state.identity.mockResolvedValue({
      primaryEmailAddressId: "primary",
      emailAddresses: [
        {
          id: "primary",
          emailAddress: "driver@example.test",
          verification: { status: "verified" },
        },
      ],
    });
    await resolveEmployee("clerk-1");
    expect(state.db.user.updateMany).toHaveBeenCalledWith({
      where: { id: 1, clerkId: null, status: "ACTIVE" },
      data: { clerkId: "clerk-1" },
    });
  });
  it.each(["INACTIVE", "ON_LEAVE"])(
    "denies %s employees even with a linked identity",
    async (status) => {
      state.db.user.findUnique.mockResolvedValue({ ...driver, status });
      await expect(resolveEmployee("clerk-1")).rejects.toMatchObject({ status: 403 });
    },
  );
  it("does not link an unverified email", async () => {
    state.db.user.findUnique.mockResolvedValue(null);
    state.identity.mockResolvedValue({
      primaryEmailAddressId: "p",
      emailAddresses: [
        { id: "p", emailAddress: "driver@example.test", verification: { status: "unverified" } },
      ],
    });
    await expect(resolveEmployee("clerk-1")).rejects.toMatchObject({ status: 403 });
    expect(state.db.user.updateMany).not.toHaveBeenCalled();
  });
});
describe("Notices", () => {
  const notice = () => ({
    id: 3,
    authorId: 2,
    author: dispatcher,
    version: 2,
    currentRevision: 2,
    status: "PUBLISHED",
    publishedAt: new Date(),
    revisions: [{ id: 4, revision: 2, audience: ["DRIVER"], recipients: [] }],
  });
  it("targets the current audience and never exposes an archived unpublished draft", () => {
    expect(canReadNotice(notice(), driver)).toBe(true);
    expect(canReadNotice(notice(), { ...driver, role: "MECHANIC" })).toBe(false);
    expect(canReadNotice({ ...notice(), publishedAt: null, status: "ARCHIVED" }, driver)).toBe(
      false,
    );
  });
  it("denies driver publication", async () => {
    await expect(saveNotice(driver, {})).rejects.toMatchObject({ status: 403 });
  });
  it("rejects reading of a revision changed since opening", async () => {
    state.db.notice.findUnique.mockResolvedValue(notice());
    await expect(noticeAction(3, driver, "read", 1)).rejects.toMatchObject({ status: 409 });
    expect(state.db.noticeRecipient.upsert).not.toHaveBeenCalled();
  });
  it("records reading idempotently", async () => {
    const readAt = new Date("2026-09-29T10:00:00Z");
    state.db.notice.findUnique.mockResolvedValue(notice());
    state.db.noticeRecipient.findUnique.mockResolvedValue({ readAt });
    await noticeAction(3, driver, "read", 2);
    expect(state.db.noticeRecipient.upsert.mock.calls[0][0].update.readAt).toEqual(readAt);
  });
  it("does not add late readers to the publication snapshot", async () => {
    state.db.notice.findUnique.mockResolvedValue(notice());
    state.db.noticeRecipient.findUnique.mockResolvedValue(null);
    await noticeAction(3, driver, "read", 2);
    expect(state.db.noticeRecipient.upsert.mock.calls[0][0].create.snapshot).toBe(false);
  });
  it("publishes scheduled notices when publish time has arrived", async () => {
    state.db.notice.findMany.mockResolvedValue([{ id: 3 }]);
    state.db.notice.findUnique.mockResolvedValue({
      ...notice(),
      status: "SCHEDULED",
      publishAt: new Date(0),
    });
    await processNoticeSchedule();
    expect(state.db.notice.update.mock.calls[0][0].data.status).toBe("PUBLISHED");
  });
});
describe("Incident workflow", () => {
  const row = () => ({
    id: 9,
    version: 1,
    reporterId: 1,
    ownerId: 3,
    status: "IN_PROGRESS",
    vehicleId: 6,
    actions: [],
    updates: [],
  });
  it("requires completed actions and a resolution", () => {
    expect(() => validateIncidentTransition(row(), "RESOLVED", "Fixed", 1)).toThrow("outstanding");
    expect(() => validateIncidentTransition(row(), "RESOLVED", "", 0)).toThrow("reason");
  });
  it("requires a reopening reason", () => {
    expect(() => validateIncidentTransition({ status: "CLOSED" }, "IN_PROGRESS", "", 0)).toThrow(
      "reason",
    );
  });
  it("rejects invalid transitions", () => {
    expect(() =>
      validateIncidentTransition({ status: "SUBMITTED" }, "RESOLVED", "Fixed", 0),
    ).toThrow("Invalid");
  });
  it("denies employee status changes and office-only updates", async () => {
    state.db.incident.findFirst.mockResolvedValue(row());
    await expect(
      incidentAction(9, driver, "transition", { version: 1, status: "CLOSED", reason: "test" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      incidentAction(9, driver, "update", { version: 1, body: "hidden", officeOnly: true }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects stale writes before applying fleet changes", async () => {
    state.db.incident.findFirst.mockResolvedValue(row());
    await expect(
      incidentAction(9, dispatcher, "fleet-impact", {
        version: 9,
        decision: "MAINTENANCE",
        reason: "Unsafe",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.db.fleetVehicle.update).not.toHaveBeenCalled();
  });
  it("explicitly applies maintenance and leaves assignments unchanged", async () => {
    state.db.incident.findFirst.mockResolvedValue(row());
    await incidentAction(9, dispatcher, "fleet-impact", {
      version: 1,
      decision: "MAINTENANCE",
      reason: "Unsafe",
    });
    expect(state.db.fleetVehicle.update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { status: "MAINTENANCE" },
    });
    expect(state.db.assignment.updateMany).not.toHaveBeenCalled();
    expect(state.db.workflowEvent.create).toHaveBeenCalled();
  });
  it("scopes job context to the employee's assignments", async () => {
    state.db.job.findUnique.mockResolvedValue({ id: 99 });
    state.db.assignment.findFirst.mockResolvedValue(null);
    await expect(validateContext(state.db, driver, { jobId: 99 })).rejects.toMatchObject({
      status: 403,
    });
  });
});
describe("Lost and found", () => {
  const report = { id: 4, version: 1, status: "OPEN", reporterId: 1, ownerId: 2 };
  const item = {
    id: 8,
    version: 1,
    status: "FOUND",
    reporterId: 1,
    ownerId: 2,
    custodianId: 1,
    storageLocation: "Bus",
  };
  beforeEach(() => {
    state.db.lostPropertyReport.findFirst.mockResolvedValue(report);
    state.db.foundPropertyItem.findFirst.mockResolvedValue(item);
  });
  it("excludes claimant details from non-office queries", async () => {
    await propertyDetail("reports", 4, driver);
    expect(
      state.db.lostPropertyReport.findFirst.mock.calls[0][0].include.privateDetails,
    ).toBeUndefined();
  });
  it("strips collection verification from employee custody responses", async () => {
    state.db.foundPropertyItem.findFirst.mockResolvedValue({
      ...item,
      custody: [{ kind: "RETURN", details: { recipientName: "private" } }],
    });
    const result = await propertyDetail("items", 8, driver);
    expect(result.custody[0].details).toBeUndefined();
  });
  it("reserves the item and updates the report atomically", async () => {
    await matchProperty(dispatcher, { reportId: 4, itemId: 8, reportVersion: 1, itemVersion: 1 });
    expect(state.db.$transaction).toHaveBeenCalledTimes(1);
    expect(state.db.lostPropertyReport.update.mock.calls[0][0].data.status).toBe("MATCHED");
    expect(state.db.foundPropertyItem.update.mock.calls[0][0].data.status).toBe("RESERVED");
  });
  it("rejects a second match against a reserved item", async () => {
    state.db.foundPropertyItem.findFirst.mockResolvedValue({ ...item, status: "RESERVED" });
    await expect(
      matchProperty(dispatcher, { reportId: 4, itemId: 8, reportVersion: 1, itemVersion: 1 }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("requires claimant verification before return", async () => {
    await expect(
      propertyAction("items", 8, dispatcher, "return", {
        version: 1,
        recipientName: "A",
        verificationNotes: "",
        collectedAt: new Date(0).toISOString(),
      }),
    ).rejects.toThrow();
    expect(state.db.propertyCustodyEvent.create).not.toHaveBeenCalled();
  });
  it("rejects repeat returns", async () => {
    state.db.foundPropertyItem.findFirst.mockResolvedValue({ ...item, status: "RETURNED" });
    await expect(
      propertyAction("items", 8, dispatcher, "return", { version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("restricts disposal to managers and admins", async () => {
    await expect(
      propertyAction("items", 8, dispatcher, "dispose", { version: 1, reason: "Unclaimed" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("records old and new custody locations", async () => {
    state.db.user.findFirst.mockResolvedValue({ id: 2 });
    await propertyAction("items", 8, driver, "transfer", {
      version: 1,
      custodianId: 2,
      storageLocation: "Office safe",
    });
    expect(state.db.propertyCustodyEvent.create.mock.calls[0][0].data).toMatchObject({
      fromCustodianId: 1,
      toCustodianId: 2,
      fromLocation: "Bus",
      toLocation: "Office safe",
    });
  });
  it("cannot release a returned match", async () => {
    state.db.propertyMatch.findUnique.mockResolvedValue({
      active: true,
      item: { status: "RETURNED" },
    });
    await expect(releaseMatch(1, dispatcher, { reason: "Incorrect match" })).rejects.toMatchObject({
      status: 409,
    });
  });
});
describe("Private files and transaction failures", () => {
  function storageSetup() {
    vi.stubEnv("SUPABASE_URL", "https://storage.example.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-key");
    vi.stubEnv("SUPABASE_WORKPLACE_BUCKET", "private");
    state.db.incident.findFirst.mockResolvedValue({ id: 9, status: "SUBMITTED" });
    state.db.attachment.create.mockImplementation(async ({ data }: any) => data);
  }
  it("reserves uploads, verifies a private bucket and makes completed files available", async () => {
    storageSetup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ public: false })))
      .mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await uploadAttachment({ incidentId: 9 }, driver, Buffer.from("%PDF-1.7 test"), "photo.pdf");
    expect(state.db.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: "READY" } }),
    );
    expect(state.db.activityLog.create).toHaveBeenCalled();
  });
  it("refuses public buckets and schedules failed uploads for cleanup", async () => {
    storageSetup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ public: true }))),
    );
    await expect(
      uploadAttachment({ incidentId: 9 }, driver, Buffer.from("%PDF-1.7 test"), "photo.pdf"),
    ).rejects.toMatchObject({ status: 503 });
    expect(state.db.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: "DELETE_PENDING" } }),
    );
  });
  it("counts pending uploads toward the ten-file limit", async () => {
    storageSetup();
    state.db.attachment.count.mockResolvedValue(10);
    await expect(
      uploadAttachment({ incidentId: 9 }, driver, Buffer.from("%PDF-1.7 test"), "photo.pdf"),
    ).rejects.toThrow("ten attachments");
    expect(state.db.attachment.create).not.toHaveBeenCalled();
  });
  it("cleans abandoned storage objects using the Supabase prefixes API", async () => {
    storageSetup();
    state.db.attachment.findMany.mockResolvedValue([{ id: "file", storageKey: "workplace/file" }]);
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await cleanupAttachments();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://storage.example.test/storage/v1/object/private",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ prefixes: ["workplace/file"] }),
      }),
    );
    expect(state.db.attachment.delete).toHaveBeenCalledWith({ where: { id: "file" } });
  });
  it("validates file signatures rather than supplied extensions", () => {
    expect(detectFile(Buffer.from("%PDF-1.7 example"))).toBe("application/pdf");
    expect(() => detectFile(Buffer.from("<script>bad</script>"))).toThrow("Only JPEG");
    expect(() => detectFile(Buffer.alloc(10 * 1024 * 1024 + 1))).toThrow("10 MB");
  });
  it("requires exactly one parent", () => {
    expect(() => attachmentParent({ incidentId: 1, reportId: 2 })).toThrow("Exactly one");
    expect(() => attachmentParent({})).toThrow("Exactly one");
  });
  it("prevents access to office-only note attachments", async () => {
    state.db.incidentUpdate.findUnique.mockResolvedValue({ incidentId: 2, officeOnly: true });
    await expect(authorizeAttachment({ updateId: 3 }, driver)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("rechecks parent scope on every download", async () => {
    state.db.attachment.findUnique.mockResolvedValue({ state: "READY", incidentId: 9 });
    state.db.incident.findFirst.mockResolvedValue(null);
    await expect(downloadAttachment("file", driver)).rejects.toMatchObject({ status: 404 });
  });
  it("denies upload to final records", async () => {
    state.db.incident.findFirst.mockResolvedValue({ status: "CLOSED" });
    await expect(authorizeAttachment({ incidentId: 9 }, driver, true)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("does not report success after a required audit failure", async () => {
    state.db.incident.findFirst.mockResolvedValue({
      version: 1,
      status: "IN_PROGRESS",
      reporterId: 1,
      actions: [],
    });
    state.db.activityLog.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(
      incidentAction(9, driver, "update", { version: 1, body: "Work complete" }),
    ).rejects.toThrow("audit unavailable");
  });
  it("maps unique and serialization conflicts to 409", async () => {
    for (const code of ["P2002", "P2034"]) {
      state.db.$transaction.mockRejectedValueOnce({ code });
      await expect(transaction(async () => null)).rejects.toMatchObject({ status: 409 });
    }
  });
  it("enforces pagination bounds", () => {
    expect(pagination({}).pageSize).toBe(25);
    expect(() => pagination({ pageSize: 101 })).toThrow();
    expect(() => pagination({ page: 0 })).toThrow();
  });
});
