import type { BookingTrip } from "@/types/booking-workflow";

const legacyKey = "booking-workspace-draft";
const prefix = `${legacyKey}:`;

export function clearOtherBookingDrafts(userId?: string | null) {
  try {
    sessionStorage.removeItem(legacyKey);
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(prefix) && key !== `${prefix}${userId}`) sessionStorage.removeItem(key);
    }
  } catch {
    /* Browser storage can be disabled by policy. */
  }
}

export function readBookingDraft(userId: string): Partial<BookingTrip> | null {
  try {
    const raw = sessionStorage.getItem(`${prefix}${userId}`);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<BookingTrip>)
      : null;
  } catch {
    return null;
  }
}

export function writeBookingDraft(userId: string, trip: BookingTrip) {
  try {
    sessionStorage.setItem(`${prefix}${userId}`, JSON.stringify(trip));
  } catch {
    /* Draft persistence is optional; saving to the server remains available. */
  }
}

export function removeBookingDraft(userId: string) {
  try {
    sessionStorage.removeItem(`${prefix}${userId}`);
  } catch {
    /* Storage is optional. */
  }
}
