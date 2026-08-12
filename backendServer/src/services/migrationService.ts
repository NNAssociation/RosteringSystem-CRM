import { prisma } from "../db.js";

/**
 * Migration service to move legacy UserJob and FleetJob records into the new Assignment model.
 */
export async function migrateLegacyJobs() {
  const jobs = await prisma.job.findMany({
    include: {
      userJobs: true,
      fleetJobs: true,
      assignments: true, // check if already migrated
    },
  });

  let migratedCount = 0;
  let skippedCount = 0;

  for (const job of jobs) {
    if (job.assignments.length > 0) {
      skippedCount++;
      continue; // Skip if already has assignments
    }

    if (job.userJobs.length === 0 && job.fleetJobs.length === 0) {
      continue; // Nothing to migrate
    }

    const scheduledStart = job.jobStartDateTime || new Date();
    const scheduledEnd = job.jobEndDateTime || new Date(scheduledStart.getTime() + 2 * 60 * 60 * 1000);
    const status = job.status === "COMPLETED" ? "COMPLETED" : "CONFIRMED";

    // Simple heuristic: if 1 driver and 1 vehicle, combine them.
    // Otherwise, create separate assignments for each driver and each vehicle.
    if (job.userJobs.length === 1 && job.fleetJobs.length === 1) {
      await prisma.assignment.create({
        data: {
          jobId: job.id,
          driverId: job.userJobs[0].userId,
          vehicleId: job.fleetJobs[0].fleetId,
          scheduledStart,
          scheduledEnd,
          status,
          notes: "Auto-migrated from legacy join tables (combined)",
        },
      });
      migratedCount++;
    } else {
      // Create separate assignments
      for (const userJob of job.userJobs) {
        await prisma.assignment.create({
          data: {
            jobId: job.id,
            driverId: userJob.userId,
            scheduledStart,
            scheduledEnd,
            status,
            notes: "Auto-migrated from UserJob",
          },
        });
        migratedCount++;
      }

      for (const fleetJob of job.fleetJobs) {
        await prisma.assignment.create({
          data: {
            jobId: job.id,
            vehicleId: fleetJob.fleetId,
            scheduledStart,
            scheduledEnd,
            status,
            notes: "Auto-migrated from FleetJob",
          },
        });
        migratedCount++;
      }
    }
  }

  return { success: true, migratedCount, skippedCount };
}
