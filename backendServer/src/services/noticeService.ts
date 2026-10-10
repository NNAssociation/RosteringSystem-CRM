import { z } from "zod";
import prismaPackage from "../../generated/prisma/index.js";
import { prisma } from "../db.js";
import { isOffice, type EmployeeActor } from "../middleware/employeeAuth.js";
import { WorkflowError } from "./workflowError.js";
import {
  audit,
  checkVersion,
  notify,
  office,
  pagination,
  personSelect,
  roles,
  textField,
  transaction,
} from "./workplaceCommon.js";
const { Prisma } = prismaPackage;

export const noticePriorities = ["INFORMATION", "WARNING", "CRITICAL", "GOOD_NEWS"] as const;
export const noticeInput = z.object({
  title: textField.max(200),
  body: textField,
  category: z.enum(["GENERAL", "SAFETY", "OPERATIONS", "MAINTENANCE", "HR"]),
  priority: z.enum(noticePriorities),
  audience: z.array(z.enum(roles)).max(roles.length).default([]),
  pinned: z.boolean().default(false),
  publishAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export function canReadNotice(row: any, actor: EmployeeActor) {
  const revision = row.revisions[0];
  return (
    isOffice(actor) ||
    (Boolean(row.publishedAt) &&
      ["PUBLISHED", "ARCHIVED"].includes(row.status) &&
      revision &&
      (!revision.audience.length || revision.audience.includes(actor.role)))
  );
}

export async function noticeDetail(id: number, actor: EmployeeActor, db: any = prisma) {
  const row = await db.notice.findUnique({
    where: { id },
    include: {
      author: { select: personSelect },
      revisions: {
        orderBy: { revision: "desc" },
        include: {
          author: { select: personSelect },
          recipients: {
            where: isOffice(actor) ? {} : { userId: actor.id },
            include: { user: { select: personSelect } },
          },
        },
      },
    },
  });
  if (!row || !canReadNotice(row, actor)) throw new WorkflowError("Notice not found", 404);
  // Earlier revisions can have different audiences. Only office staff may inspect their history.
  if (!isOffice(actor)) row.revisions = row.revisions.slice(0, 1);
  return row;
}

async function publish(tx: any, row: any, actor: EmployeeActor) {
  const revision =
    (await tx.noticeRevision.findUnique({
      where: { noticeId_revision: { noticeId: row.id, revision: row.currentRevision } },
    })) || row.revisions?.[0];
  const audience = revision?.audience || [];
  const recipients = await tx.user.findMany({
    where: { status: "ACTIVE", role: audience.length ? { in: audience } : { not: null } },
    select: { id: true },
  });
  if (revision) {
    await tx.noticeRecipient.createMany({
      data: recipients.map((u: any) => ({ revisionId: revision.id, userId: u.id })),
      skipDuplicates: true,
    });
  }
  await tx.notice.update({
    where: { id: row.id },
    data: {
      status: "PUBLISHED",
      publishAt: new Date(),
      publishedAt: new Date(),
      version: { increment: 1 },
    },
  });
  await notify(
    tx,
    recipients.map((u: any) => u.id),
    "Notice",
    row.id,
    revision?.title || "Notice",
    `/dashboard/notices/${row.id}`,
  );
  await audit(tx, actor, "Notice", row.id, "NOTICE_PUBLISHED", { revision: row.currentRevision });
}

export async function saveNotice(
  actor: EmployeeActor,
  raw: unknown,
  id?: number,
  version?: number,
) {
  office(actor);
  const input = noticeInput.parse(raw);
  return transaction(async (tx) => {
    const old = id ? await noticeDetail(id, actor, tx) : null;
    if (old) {
      checkVersion(old, version!);
      if (old.status === "ARCHIVED")
        throw new WorkflowError("Archived notices cannot be revised", 409);
    }
    const { pinned, publishAt, ...content } = input;
    const revision = old ? old.currentRevision + 1 : 1;
    const isScheduled = Boolean(publishAt && new Date(publishAt) > new Date());
    const shouldPublishNow = !old && !isScheduled;
    const initialStatus = isScheduled ? "SCHEDULED" : "PUBLISHED";
    const data = {
      pinned,
      publishAt: publishAt ? new Date(publishAt) : shouldPublishNow ? new Date() : null,
      ...(old
        ? old.status === "SCHEDULED" && !publishAt
          ? { status: "DRAFT" }
          : {}
        : { status: initialStatus, publishedAt: shouldPublishNow ? new Date() : null }),
    };
    const row = old
      ? await tx.notice.update({
          where: { id },
          data: { ...data, currentRevision: revision, version: { increment: 1 } },
        })
      : await tx.notice.create({ data: { ...data, authorId: actor.id } });
    await tx.noticeRevision.create({
      data: { ...content, noticeId: row.id, revision, authorId: actor.id },
    });
    await audit(tx, actor, "Notice", row.id, old ? "NOTICE_REVISED" : "NOTICE_CREATED", {
      revision,
    });
    if (old?.status === "PUBLISHED" || shouldPublishNow) await publish(tx, row, actor);
    return row;
  });
}

export async function noticeAction(
  id: number,
  actor: EmployeeActor,
  action: string,
  version?: number,
) {
  return transaction(async (tx) => {
    const row = await noticeDetail(id, actor, tx),
      revision = row.revisions[0];
    if (action === "read" || action === "acknowledge") {
      checkVersion(row, version!);
      if (row.status !== "PUBLISHED")
        throw new WorkflowError("This notice is no longer active", 409);
      const existing = await tx.noticeRecipient.findUnique({
        where: { revisionId_userId: { revisionId: revision.id, userId: actor.id } },
      });
      const data = { readAt: existing?.readAt || new Date() };
      await tx.noticeRecipient.upsert({
        where: { revisionId_userId: { revisionId: revision.id, userId: actor.id } },
        create: { revisionId: revision.id, userId: actor.id, snapshot: false, ...data },
        update: data,
      });
    } else {
      office(actor);
      checkVersion(row, version!);
      if (action === "archive")
        await tx.notice.update({
          where: { id },
          data: { status: "ARCHIVED", version: { increment: 1 } },
        });
      else if (action === "publish") {
        if (!["DRAFT", "SCHEDULED"].includes(row.status))
          throw new WorkflowError("Only drafts or scheduled notices can be published", 409);
        await tx.notice.update({
          where: { id },
          data: {
            version: { increment: 1 },
            status: row.publishAt && row.publishAt > new Date() ? "SCHEDULED" : "PUBLISHED",
          },
        });
        if (!row.publishAt || row.publishAt <= new Date()) await publish(tx, row, actor);
      } else throw new WorkflowError("Unknown notice action");
      await audit(tx, actor, "Notice", id, `NOTICE_${action.toUpperCase()}`);
    }
    return { success: true };
  });
}

export async function listNotices(raw: any, actor: EmployeeActor) {
  const q = pagination(raw),
    source = noticeListSource(actor, q);
  return prisma.$transaction(
    async (tx: any) => {
      const counts = await tx.$queryRaw(Prisma.sql`SELECT COUNT(*) AS count ${source}`);
      const ids = await tx.$queryRaw(
        Prisma.sql`SELECT n.id ${source} ORDER BY n.pinned DESC, CASE r.priority WHEN 'CRITICAL' THEN 4 WHEN 'WARNING' THEN 3 WHEN 'GOOD_NEWS' THEN 2 ELSE 1 END DESC, COALESCE(n."publishedAt", n."createdAt") DESC, n.id DESC LIMIT ${q.pageSize} OFFSET ${q.skip}`,
      );
      const records = await tx.notice.findMany({
        where: { id: { in: ids.map((n: any) => n.id) } },
        include: {
          revisions: {
            orderBy: { revision: "desc" },
            take: 1,
            include: { recipients: { where: { userId: actor.id } } },
          },
        },
      });
      return {
        items: ids.map((n: any) => records.find((r: any) => r.id === n.id)),
        total: Number(counts[0].count),
        page: q.page,
        pageSize: q.pageSize,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

function noticeListSource(actor: EmployeeActor, q: ReturnType<typeof pagination>) {
  return Prisma.sql`FROM "Notice" n JOIN "NoticeRevision" r ON r."noticeId" = n.id AND r.revision = n."currentRevision"
    LEFT JOIN "NoticeRecipient" receipt ON receipt."revisionId" = r.id AND receipt."userId" = ${actor.id}
    WHERE (${isOffice(actor)} OR (n."publishedAt" IS NOT NULL AND n.status IN ('PUBLISHED','ARCHIVED') AND (cardinality(r.audience) = 0 OR ${actor.role} = ANY(r.audience::text[]))))
    AND ((n.status = 'ARCHIVED') = ${q.view === "archived"})
    AND (${q.search} = '' OR strpos(lower(r.title || ' ' || r.body), lower(${q.search})) > 0)
    AND (${q.category || ""} = '' OR r.category = ${q.category || ""}) AND (${q.status || ""} = '' OR n.status = ${q.status || ""})
    AND (${q.view !== "unread"} OR receipt."readAt" IS NULL)`;
}

export async function visibleNoticeIds(actor: EmployeeActor) {
  return prisma.$queryRaw(Prisma.sql`SELECT n.id ${noticeListSource(actor, pagination({}))}`);
}

export async function processNoticeSchedule() {
  if (process.env.NOTICES_ENABLED !== "true") return;
  const rows = await prisma.notice.findMany({
    where: { status: "SCHEDULED", publishAt: { lte: new Date() } },
    select: { id: true },
  });
  for (const { id } of rows)
    await transaction(async (tx) => {
      const row = await tx.notice.findUnique({
        where: { id },
        include: { author: true, revisions: true },
      });
      const actor = row?.author;
      if (row && row.status === "SCHEDULED" && row.publishAt && row.publishAt <= new Date()) {
        await publish(tx, row, actor);
      }
    });
}
