import express, { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { isOffice, requireEmployee } from "../middleware/employeeAuth.js";
import * as files from "../services/attachmentService.js";
import { businessTimeZone } from "../services/businessTime.js";
import * as incidents from "../services/incidentService.js";
import * as notices from "../services/noticeService.js";
import * as property from "../services/propertyService.js";
import { WorkflowError } from "../services/workflowError.js";
import {
  office,
  pagination,
  personSelect,
  positiveId,
  scope,
} from "../services/workplaceCommon.js";

export const workplaceRouter = Router();
const action = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
  try {
    await fn(req, res);
  } catch (e: any) {
    if (!e.status && !(e instanceof z.ZodError))
      console.error("[Workplace] request failed", e.code || e.name);
    res.status(e instanceof z.ZodError ? 400 : e.status || 500).json({
      error:
        e instanceof z.ZodError
          ? e.issues.map((i) => i.message).join(", ")
          : e.status
            ? e.message
            : "Unable to complete request. Try again.",
    });
  }
};
export const workplaceFlags = () => ({
  notices: process.env.NOTICES_ENABLED === "true",
  incidents: process.env.INCIDENTS_ENABLED === "true",
  lostProperty: process.env.LOST_PROPERTY_ENABLED === "true",
});
workplaceRouter.use((req, _res, next) => {
  if (!req.headers.authorization && typeof req.query.token === "string" && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});
workplaceRouter.use(requireEmployee);
workplaceRouter.get(
  "/me",
  action(async (req, res) =>
    res.json({
      employee: {
        id: req.employee.id,
        firstName: req.employee.firstName,
        lastName: req.employee.lastName,
        role: req.employee.role,
      },
      office: isOffice(req.employee),
      canDispose: ["ADMIN", "MANAGER"].includes(req.employee.role),
      features: workplaceFlags(),
      timeZone: businessTimeZone(),
    }),
  ),
);
for (const [path, flag] of [
  ["/notices", "notices"],
  ["/incidents", "incidents"],
  ["/lost-property", "lostProperty"],
] as const)
  workplaceRouter.use(path, (_req, res, next) => {
    if (!workplaceFlags()[flag]) {
      res.status(404).json({ error: "This feature is disabled" });
      return;
    }
    next();
  });
workplaceRouter.get(
  "/workplace/lookups",
  action(async (req, res) => {
    const actor = req.employee,
      search = z
        .string()
        .max(100)
        .parse(req.query.search || "");
    const filter = search ? { contains: search, mode: "insensitive" } : undefined;
    const [employees, vehicles, jobs, depots, customers] = await Promise.all([
      prisma.user.findMany({
        where: {
          status: "ACTIVE",
          ...(filter ? { OR: [{ firstName: filter as any }, { lastName: filter as any }] } : {}),
        },
        select: personSelect,
        take: 50,
        orderBy: { firstName: "asc" },
      }),
      prisma.fleetVehicle.findMany({
        where: filter ? { licensePlate: filter as any } : {},
        select: { id: true, licensePlate: true },
        take: 50,
        orderBy: { licensePlate: "asc" },
      }),
      prisma.job.findMany({
        where: {
          ...(isOffice(actor) ? {} : { assignments: { some: { driverId: actor.id } } }),
          ...(filter ? { jobStartLocation: filter as any } : {}),
        },
        select: { id: true, bookingId: true, jobStartLocation: true, jobStartDateTime: true },
        take: 50,
        orderBy: { jobStartDateTime: "desc" },
      }),
      prisma.depot.findMany({ select: { id: true, name: true }, take: 100 }),
      isOffice(actor)
        ? prisma.customer.findMany({
            where: filter ? { name: filter as any } : {},
            select: { id: true, name: true },
            take: 50,
          })
        : [],
    ]);
    res.json({ employees, vehicles, jobs, depots, customers });
  }),
);
workplaceRouter.get(
  "/notices",
  action(async (req, res) => res.json(await notices.listNotices(req.query, req.employee))),
);
workplaceRouter.post(
  "/notices",
  action(async (req, res) =>
    res.status(201).json(await notices.saveNotice(req.employee, req.body)),
  ),
);
workplaceRouter.get(
  "/notices/:id",
  action(async (req, res) =>
    res.json(await notices.noticeDetail(positiveId.parse(req.params.id), req.employee)),
  ),
);
workplaceRouter.patch(
  "/notices/:id",
  action(async (req, res) =>
    res.json(
      await notices.saveNotice(
        req.employee,
        req.body,
        positiveId.parse(req.params.id),
        positiveId.parse(req.body.version),
      ),
    ),
  ),
);
workplaceRouter.post(
  "/notices/:id/:action",
  action(async (req, res) =>
    res.json(
      await notices.noticeAction(
        positiveId.parse(req.params.id),
        req.employee,
        req.params.action,
        positiveId.parse(req.body.version),
      ),
    ),
  ),
);
workplaceRouter.get(
  "/incidents",
  action(async (req, res) => res.json(await incidents.listIncidents(req.query, req.employee))),
);
workplaceRouter.post(
  "/incidents",
  action(async (req, res) =>
    res.status(201).json(await incidents.createIncident(req.employee, req.body)),
  ),
);
workplaceRouter.get(
  "/incidents/:id",
  action(async (req, res) =>
    res.json(await incidents.incidentDetail(positiveId.parse(req.params.id), req.employee)),
  ),
);
workplaceRouter.get(
  "/incidents/:id/affected-assignments",
  action(async (req, res) => {
    office(req.employee);
    const row = await incidents.incidentDetail(positiveId.parse(req.params.id), req.employee);
    res.json(
      row.vehicleId
        ? await prisma.assignment.findMany({
            where: {
              vehicleId: row.vehicleId,
              OR: [
                { status: "IN_PROGRESS" },
                {
                  status: { in: ["PENDING", "CONFIRMED"] },
                  OR: [
                    { scheduledStart: { gte: new Date() } },
                    { scheduledEnd: { gte: new Date() } },
                    { scheduledEnd: null },
                  ],
                },
              ],
            },
            select: {
              id: true,
              jobId: true,
              status: true,
              scheduledStart: true,
              scheduledEnd: true,
            },
            orderBy: { scheduledStart: "asc" },
          })
        : [],
    );
  }),
);
workplaceRouter.post(
  "/incidents/:id/:action",
  action(async (req, res) =>
    res.json(
      await incidents.incidentAction(
        positiveId.parse(req.params.id),
        req.employee,
        req.params.action,
        req.body,
      ),
    ),
  ),
);
for (const kind of ["reports", "items"]) {
  workplaceRouter.get(
    `/lost-property/${kind}`,
    action(async (req, res) =>
      res.json(await property.listProperty(kind, req.query, req.employee)),
    ),
  );
  workplaceRouter.post(
    `/lost-property/${kind}`,
    action(async (req, res) =>
      res.status(201).json(await property.createProperty(kind, req.employee, req.body)),
    ),
  );
  workplaceRouter.get(
    `/lost-property/${kind}/:id`,
    action(async (req, res) =>
      res.json(await property.propertyDetail(kind, positiveId.parse(req.params.id), req.employee)),
    ),
  );
  workplaceRouter.post(
    `/lost-property/${kind}/:id/:action`,
    action(async (req, res) =>
      res.json(
        await property.propertyAction(
          kind,
          positiveId.parse(req.params.id),
          req.employee,
          req.params.action,
          req.body,
        ),
      ),
    ),
  );
}
workplaceRouter.post(
  "/lost-property/matches",
  action(async (req, res) =>
    res.status(201).json(await property.matchProperty(req.employee, req.body)),
  ),
);
workplaceRouter.post(
  "/lost-property/matches/:id/release",
  action(async (req, res) =>
    res.json(await property.releaseMatch(positiveId.parse(req.params.id), req.employee, req.body)),
  ),
);
workplaceRouter.get(
  "/attachments",
  action(async (req, res) =>
    res.json(await files.listAttachments(files.attachmentParent(req.query), req.employee)),
  ),
);
workplaceRouter.post(
  "/attachments",
  express.raw({ type: "*/*", limit: "10mb" }),
  action(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw new WorkflowError("Send the file as raw binary data");
    res.status(201).json(
      await files.uploadAttachment(
        req.query,
        req.employee,
        req.body,
        z
          .string()
          .max(200)
          .parse(req.query.filename || "attachment"),
      ),
    );
  }),
);
workplaceRouter.get(
  "/attachments/:id",
  action(async (req, res) => {
    const { row, bytes } = await files.downloadAttachment(req.params.id, req.employee);
    const isInline = req.query.download !== "true";
    res.set("X-Content-Type-Options", "nosniff").type(row.mimeType);
    if (isInline) {
      res.set("Content-Disposition", `inline; filename="${encodeURIComponent(row.filename)}"`);
    } else {
      res.attachment(row.filename);
    }
    res.send(bytes);
  }),
);
workplaceRouter.delete(
  "/attachments/:id",
  action(async (req, res) => {
    await files.removeAttachment(req.params.id, req.employee);
    res.json({ success: true });
  }),
);
workplaceRouter.get(
  "/notifications",
  action(async (req, res) => {
    const q = pagination(req.query),
      flags = workplaceFlags();
    // Filter by current record visibility as well as recipient: reassignment/role changes revoke access.
    const [visibleNotices, incidentRows, reports, items] = await Promise.all([
      flags.notices ? notices.visibleNoticeIds(req.employee) : [],
      flags.incidents
        ? prisma.incident.findMany({ where: scope(req.employee), select: { id: true } })
        : [],
      flags.lostProperty
        ? prisma.lostPropertyReport.findMany({ where: scope(req.employee), select: { id: true } })
        : [],
      flags.lostProperty
        ? prisma.foundPropertyItem.findMany({
            where: scope(req.employee, "foundPropertyItem"),
            select: { id: true },
          })
        : [],
    ]);
    const where = {
      userId: req.employee.id,
      OR: [
        ["Notice", visibleNotices],
        ["Incident", incidentRows],
        ["LostPropertyReport", reports],
        ["FoundPropertyItem", items],
      ].map(([entity, records]: any) => ({
        entity,
        entityId: { in: records.map((r: any) => r.id) },
      })),
    };
    const [rows, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: q.skip,
        take: q.pageSize,
      }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    // Resolve current notice content so existing generic notification titles are useful too.
    const noticeIds = [
      ...new Set<number>(
        rows.filter((row: any) => row.entity === "Notice").map((row: any) => row.entityId),
      ),
    ];
    const noticeRecords = noticeIds.length
      ? await prisma.notice.findMany({
          where: { id: { in: noticeIds } },
          include: { revisions: { orderBy: { revision: "desc" }, take: 1 } },
        })
      : [];
    const noticeMap = new Map<number, any>(noticeRecords.map((notice: any) => [notice.id, notice]));
    const notifications = rows.flatMap((row: any) => {
      if (row.entity !== "Notice") return [{ ...row, priority: "INFORMATION" }];
      const notice = noticeMap.get(row.entityId);
      // Recheck visibility in case the audience changed after the initial scope query.
      if (!notice || !notices.canReadNotice(notice, req.employee)) return [];
      const revision = notice.revisions[0];
      return [
        {
          ...row,
          title: revision?.title || "Notice",
          priority: revision?.priority || "INFORMATION",
          category: revision?.category,
        },
      ];
    });
    res.json({ items: notifications, unreadCount });
  }),
);
workplaceRouter.post(
  "/notifications/:id/read",
  action(async (req, res) => {
    await prisma.notification.updateMany({
      where: { id: positiveId.parse(req.params.id), userId: req.employee.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true });
  }),
);
