import { prisma } from "../db.js";

// ── Default Values ────────────────────────────────────────

export const SCHEDULING_DEFAULTS: Record<string, { value: string; description: string }> = {
  maxContinuousDrivingMinutes: { value: "330", description: "Maximum continuous driving time in minutes (default 5.5 hours)" },
  minBreakDurationMinutes: { value: "30", description: "Minimum break duration in minutes to reset driving counter" },
  maxShiftDurationMinutes: { value: "720", description: "Maximum total shift duration in minutes (default 12 hours)" },
  bufferMinutes: { value: "10", description: "Buffer/rest time in minutes between consecutive jobs" },
  depotTravelBuffer: { value: "10", description: "Extra buffer in minutes added to depot-to-first-job travel" },
  transitTimeMinutes: { value: "60", description: "Minimum transit time in minutes between end of one job and start of the next job" },
};

// ── Types ─────────────────────────────────────────────────

export interface SchedulingRules {
  maxContinuousDrivingMinutes: number;
  minBreakDurationMinutes: number;
  maxShiftDurationMinutes: number;
  bufferMinutes: number;
  depotTravelBuffer: number;
  transitTimeMinutes: number;
}

// ── Service Methods ───────────────────────────────────────

/**
 * Get all scheduling settings as a flat key-value object.
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const settings = await prisma.schedulingSetting.findMany();
  const result: Record<string, string> = {};

  // Start with defaults
  for (const [key, def] of Object.entries(SCHEDULING_DEFAULTS)) {
    result[key] = def.value;
  }

  // Override with DB values
  for (const setting of settings) {
    result[setting.key] = setting.value;
  }

  return result;
}

/**
 * Get a single setting value, falling back to default.
 */
export async function getSettingValue(key: string): Promise<string> {
  const setting = await prisma.schedulingSetting.findUnique({ where: { key } });
  if (setting) return setting.value;
  return SCHEDULING_DEFAULTS[key]?.value ?? "0";
}

/**
 * Get structured scheduling rules object for use by the scheduling engine.
 * This is the primary interface for the scheduler to obtain configurable values.
 */
export async function getSchedulingRules(): Promise<SchedulingRules> {
  const all = await getAllSettings();
  return {
    maxContinuousDrivingMinutes: parseInt(all.maxContinuousDrivingMinutes ?? "330", 10),
    minBreakDurationMinutes: parseInt(all.minBreakDurationMinutes ?? "30", 10),
    maxShiftDurationMinutes: parseInt(all.maxShiftDurationMinutes ?? "720", 10),
    bufferMinutes: parseInt(all.bufferMinutes ?? "10", 10),
    depotTravelBuffer: parseInt(all.depotTravelBuffer ?? "10", 10),
    transitTimeMinutes: parseInt(all.transitTimeMinutes ?? "60", 10),
  };
}

/**
 * Update scheduling settings. Only updates provided keys.
 */
export async function updateSettings(updates: Record<string, string | number>): Promise<Record<string, string>> {
  const validKeys = Object.keys(SCHEDULING_DEFAULTS);

  for (const [key, value] of Object.entries(updates)) {
    if (!validKeys.includes(key)) continue;

    const strValue = String(value);
    const description = SCHEDULING_DEFAULTS[key]?.description ?? "";

    await prisma.schedulingSetting.upsert({
      where: { key },
      update: { value: strValue },
      create: { key, value: strValue, description },
    });
  }

  return getAllSettings();
}

/**
 * Seed default scheduling settings if they don't exist.
 */
export async function seedDefaultSettings(): Promise<void> {
  for (const [key, def] of Object.entries(SCHEDULING_DEFAULTS)) {
    const existing = await prisma.schedulingSetting.findUnique({ where: { key } });
    if (!existing) {
      await prisma.schedulingSetting.create({
        data: { key, value: def.value, description: def.description },
      });
    }
  }
}
