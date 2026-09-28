import { prisma } from "../db.js";

/**
 * Migration service to move legacy UserJob and FleetJob records into the new Assignment model.
 */
export async function migrateLegacyJobs() {
  // Legacy tables UserJob and FleetJob have been removed from the schema.
  return { success: true, migratedCount: 0, skippedCount: 0, notes: "Deprecated" };
}
