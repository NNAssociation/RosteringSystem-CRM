import type { BookingCategory } from "@/types";

// ── Booking Category Tab Configuration ────────────────────

export interface BookingCategoryConfig {
  id: BookingCategory;
  label: string;
  iconName: string;
  description: string;
  sections: SectionId[];
}

export type SectionId =
  | "customer"
  | "locations"
  | "datetime"
  | "return_datetime"
  | "recurrence"
  | "transport"
  | "notes";

export const BOOKING_CATEGORIES: BookingCategoryConfig[] = [
  {
    id: "one_way",
    label: "One Way",
    iconName: "TrendingFlat",
    description: "Single journey from A to B",
    sections: ["customer", "locations", "datetime", "transport", "notes"],
  },
  {
    id: "round_trip",
    label: "Round Trip",
    iconName: "SwapHoriz",
    description: "Journey with return trip",
    sections: ["customer", "locations", "return_datetime", "transport", "notes"],
  },
  {
    id: "repeatable",
    label: "Repeatable",
    iconName: "Repeat",
    description: "Recurring scheduled journeys",
    sections: ["customer", "locations", "datetime", "recurrence", "transport", "notes"],
  },
];

// ── Default Form Values ───────────────────────────────────

export const DEFAULT_FORM_DATA = {
  bookingType: "one_way" as BookingCategory,
  customerId: undefined,
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  pickupLocation: { address: "" },
  dropLocation: { address: "" },
  pickupDate: new Date().toISOString().split("T")[0],
  pickupTime: "09:00",
  returnDate: "",
  returnTime: "",
  waitingDuration: undefined,
  repeatType: undefined,
  repeatDays: [] as number[],
  repeatStartDate: "",
  repeatEndDate: "",
  paxCount: 1,
  busCount: 1,
  estimatedDuration: undefined,
  estimatedDistance: "",
  calculatedEndTime: "",
  notes: "",
  subject: "",
};

// ── Day Labels for Repeat Config ──────────────────────────

export const WEEKDAY_LABELS = [
  { value: 0, label: "Sun", short: "S" },
  { value: 1, label: "Mon", short: "M" },
  { value: 2, label: "Tue", short: "T" },
  { value: 3, label: "Wed", short: "W" },
  { value: 4, label: "Thu", short: "T" },
  { value: 5, label: "Fri", short: "F" },
  { value: 6, label: "Sat", short: "S" },
];

// ── Repeat Type Options ───────────────────────────────────

export const REPEAT_TYPE_OPTIONS = [
  { value: "daily", label: "Daily", description: "Every day" },
  { value: "weekly", label: "Weekly", description: "Specific days each week" },
  { value: "monthly", label: "Monthly", description: "Same date each month" },
];
