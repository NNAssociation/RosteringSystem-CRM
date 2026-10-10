import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createIncident, incidentAction } from "../services/incidentService.js";
import { listNotices, noticeAction, saveNotice } from "../services/noticeService.js";
import { createProperty, matchProperty, propertyAction } from "../services/propertyService.js";
const state = vi.hoisted(() => ({ db: null as any }));
vi.mock("../db.js", () => ({
  get prisma() {
    return state.db;
  },
}));
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Workplace PostgreSQL transactions (dedicated _test database)",
  () => {
    let pool: pg.Pool, client: any, admin: any, driver: any;
    const ids: number[] = [],
      incidents: number[] = [],
      reports: number[] = [],
      items: number[] = [],
      notices: number[] = [];
    beforeAll(async () => {
      const url = new URL(process.env.TEST_DATABASE_URL!);
      if (!url.pathname.endsWith("_test"))
        throw new Error(
          "TEST_DATABASE_URL must target a dedicated database ending in _test with migrations applied",
        );
      const [{ default: pkg }, { PrismaPg }] = await Promise.all([
        import("../../generated/prisma/index.js"),
        import("@prisma/adapter-pg"),
      ]);
      pool = new pg.Pool({ connectionString: url.toString() });
      client = new pkg.PrismaClient({ adapter: new PrismaPg(pool as any) });
      state.db = client;
      const prefix = randomUUID();
      admin = await client.user.create({
        data: {
          email: `${prefix}-admin@example.test`,
          firstName: "Admin",
          role: "ADMIN",
          skills: [],
        },
      });
      ids.push(admin.id);
      driver = await client.user.create({
        data: {
          email: `${prefix}-driver@example.test`,
          firstName: "Driver",
          role: "DRIVER",
          skills: [],
        },
      });
      ids.push(driver.id);
    });
    afterAll(async () => {
      if (!client) return;
      state.db = client;
      await client.notification.deleteMany({
        where: {
          OR: [
            { userId: { in: ids } },
            { entity: "Incident", entityId: { in: incidents } },
            { entity: "Notice", entityId: { in: notices } },
            { entity: "LostPropertyReport", entityId: { in: reports } },
            { entity: "FoundPropertyItem", entityId: { in: items } },
          ],
        },
      });
      await client.activityLog.deleteMany({ where: { userId: { in: ids } } });
      await client.incidentUpdate.deleteMany({ where: { incidentId: { in: incidents } } });
      await client.incidentAction.deleteMany({ where: { incidentId: { in: incidents } } });
      await client.incident.deleteMany({ where: { id: { in: incidents } } });
      await client.propertyCustodyEvent.deleteMany({ where: { itemId: { in: items } } });
      await client.propertyMatch.deleteMany({ where: { itemId: { in: items } } });
      await client.propertyClaimant.deleteMany({ where: { reportId: { in: reports } } });
      await client.foundPropertyItem.deleteMany({ where: { id: { in: items } } });
      await client.lostPropertyReport.deleteMany({ where: { id: { in: reports } } });
      await client.noticeRecipient.deleteMany({
        where: { revision: { noticeId: { in: notices } } },
      });
      await client.noticeRevision.deleteMany({ where: { noticeId: { in: notices } } });
      await client.notice.deleteMany({ where: { id: { in: notices } } });
      await client.user.deleteMany({ where: { id: { in: ids } } });
      await client.$disconnect();
      await pool.end();
    });
    it("publishes, paginates and acknowledges a targeted notice", async () => {
      const notice = await saveNotice(admin, {
        title: "Safety briefing",
        body: "Test notice",
        category: "SAFETY",
        priority: "WARNING",
        audience: ["DRIVER"],
        acknowledgementRequired: true,
      });
      notices.push(notice.id);
      await noticeAction(notice.id, admin, "publish", 1);
      const list = await listNotices({ search: "Safety briefing" }, driver);
      expect(list.items.some((n: any) => n.id === notice.id)).toBe(true);
      await noticeAction(notice.id, driver, "acknowledge", 2);
      await noticeAction(notice.id, driver, "acknowledge", 2);
      expect(
        await client.noticeRecipient.count({
          where: {
            userId: driver.id,
            revision: { noticeId: notice.id },
            acknowledgedAt: { not: null },
          },
        }),
      ).toBe(1);
    });
    it.each(["activityLog", "notification"])(
      "rolls back incident transitions if the mandatory %s write fails",
      async (model) => {
        const incident = await createIncident(driver, {
          title: "Test incident",
          description: "Test",
          occurredAt: new Date().toISOString(),
          location: "Depot",
          category: "OTHER",
          severity: "LOW",
        });
        incidents.push(incident.id);
        state.db = {
          $transaction: (fn: any, opts: any) =>
            client.$transaction(
              (tx: any) =>
                fn(
                  new Proxy(tx, {
                    get(target, key) {
                      return key === model
                        ? {
                            create: () => {
                              throw new Error("mandatory write failure");
                            },
                            createMany: () => {
                              throw new Error("mandatory write failure");
                            },
                          }
                        : target[key];
                    },
                  }),
                ),
              opts,
            ),
        };
        await expect(
          incidentAction(incident.id, admin, "transition", {
            version: 1,
            status: "UNDER_REVIEW",
            reason: "Review",
          }),
        ).rejects.toThrow("mandatory write failure");
        state.db = client;
        expect((await client.incident.findUnique({ where: { id: incident.id } })).status).toBe(
          "SUBMITTED",
        );
        expect(await client.incidentUpdate.count({ where: { incidentId: incident.id } })).toBe(0);
      },
    );
    it("allows only one competing match and one verified return", async () => {
      const input = {
        description: "Blue bag",
        category: "BAG",
        occurredAt: new Date().toISOString(),
        location: "Depot",
      };
      const report = await createProperty("reports", admin, input);
      reports.push(report.id);
      const item = await createProperty("items", driver, {
        ...input,
        storageLocation: "Depot desk",
      });
      items.push(item.id);
      await propertyAction("items", item.id, driver, "transfer", {
        version: 1,
        custodianId: admin.id,
        storageLocation: "Depot desk",
      });
      const matchInput = { reportId: report.id, itemId: item.id, reportVersion: 1, itemVersion: 2 };
      const results = await Promise.allSettled([
        matchProperty(admin, matchInput),
        matchProperty(admin, matchInput),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const body = {
        version: 3,
        recipientName: "Owner",
        verificationNotes: "Identified bag contents",
        collectedAt: new Date().toISOString(),
      };
      const returns = await Promise.allSettled([
        propertyAction("items", item.id, admin, "return", body),
        propertyAction("items", item.id, admin, "return", body),
      ]);
      expect(returns.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(
        (await client.lostPropertyReport.findUnique({ where: { id: report.id } })).status,
      ).toBe("RETURNED");
      expect(
        await client.propertyCustodyEvent.count({ where: { itemId: item.id, kind: "RETURN" } }),
      ).toBe(1);
    });
  },
);
