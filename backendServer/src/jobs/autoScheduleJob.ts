import { startOfWeek, addDays, startOfDay, endOfDay } from "date-fns";
import { runAutoScheduling } from "../services/autoScheduleService.js";

/**
 * Background job that automatically schedules jobs for the next two weeks,
 * running exactly one week in advance.
 * Example: On Monday 06/07/2026, it schedules trips for 13/07/2026 to 26/07/2026.
 */
export async function processAutoSchedule(job: any) {
  const today = job.data?.runDate ? new Date(job.data.runDate) : new Date();
  
  // Find Monday of this week
  const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
  
  // Start date = Monday of next week (Monday + 7 days)
  const startDate = startOfDay(addDays(startOfThisWeek, 7));
  
  // End date = Sunday of the following week (Monday + 20 days)
  const endDate = endOfDay(addDays(startOfThisWeek, 20));



  try {
    const result = await runAutoScheduling(startDate, endDate);

    return result;
  } catch (err: any) {
    console.error(`[Auto Schedule Job] Failed to run:`, err);
    throw err;
  }
}
