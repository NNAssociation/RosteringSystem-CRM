import { prisma } from "../db.js";
import { getIO } from "../websocket/socketServer.js";

/**
 * Scans for jobs that are unassigned and within the SLA warning window.
 * Emits a WebSocket alert to dispatchers if violations are found.
 */
export async function processSLAWarnings(job: any) {
  const slaMinutes = job.data?.slaMinutes || 60;
  const now = new Date();
  const slaThreshold = new Date(now.getTime() + slaMinutes * 60000);

  // Find all unassigned jobs that start before the SLA threshold but are still in the future
  const upcomingUnassignedJobs = await prisma.job.findMany({
    where: {
      status: "UNASSIGNED",
      jobStartDateTime: {
        lte: slaThreshold,
        gte: now, // Don't alert for jobs that have already passed (or handle them differently)
      }
    },
    include: {
      booking: {
        select: {
          customer: { select: { name: true } }
        }
      }
    }
  });

  if (upcomingUnassignedJobs.length > 0) {

    
    // Broadcast alert to dispatchers
    const io = getIO();
    io.of("/dispatch").emit("alert.sla_warning", {
      message: `${upcomingUnassignedJobs.length} jobs require immediate assignment!`,
      jobs: upcomingUnassignedJobs.map((j: any) => ({
        id: j.id,
        time: j.jobStartDateTime,
        customer: j.booking?.customer?.name
      }))
    });
  } else {

  }

  return { alerted: upcomingUnassignedJobs.length };
}
