import { prisma } from "../db.js";

/**
 * AuditService — writes structured activity logs.
 * Replaces the broken AuditLog model (which was 1:1 with User).
 * Uses the new ActivityLog model.
 */
export async function logActivity(params: {
  action: string;
  entity: string;
  entityId: number;
  userId?: number;
  changes?: Record<string, any>;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        userId: params.userId || null,
        changes: params.changes || null,
      },
    });
  } catch (error) {
    // Audit logging should never crash the main operation
    console.error("[AuditService] Failed to write activity log:", error);
  }
}

/**
 * Get activity logs for a specific entity.
 */
export async function getActivityLogs(entity: string, entityId: number) {
  return prisma.activityLog.findMany({
    where: { entity, entityId },
    orderBy: { timestamp: "desc" },
    take: 50,
  });
}
