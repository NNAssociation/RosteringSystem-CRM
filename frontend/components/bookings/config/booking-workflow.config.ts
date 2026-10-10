import type { StructuredLocation } from "@/types";
import type { BookingTrip, QuotationLineItem } from "@/types/booking-workflow";

export const WORKSPACE_STEPS = [
  "Basic details",
  "Locations",
  "Quotation",
  "Preview & send",
  "Customer response",
] as const;

export const FIELD_INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500";

export const SUPPORTED_CURRENCIES = ["AUD", "NZD", "USD", "GBP", "EUR"] as const;

export const AUSTRALIAN_TIMEZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Australia/Hobart",
] as const;

export const DEFAULT_QUOTATION_MESSAGE =
  "Thank you for your enquiry. Please review your trip details and quotation below.";

export const DEFAULT_QUOTATION_TERMS = `THIS IS NOT A BOOKING, IT IS A QUOTE ONLY

TERMS AND CONDITIONS
- Should a vehicle need to be cancelled, we require at least 24 hours notice or a cancellation fee may apply.
- If booking is cancelled on the day of charter, full payment may still be due.
- If departing venue any later than booked time, an additional fee of $100.00 per hour will apply.
- Hirer's are to keep a passenger listing of persons on the charter.
- E&OE = errors and omissions excepted`;

export const INITIAL_TRIP_STATE: BookingTrip = {
  returnEndDate: "",
  returnEndTime: "",
  returnItinerary: [] as StructuredLocation[],
  returnItineraryConfirmed: true,
  subject: "",
  customerName: "",
  customerEmail: "",
  customerId: undefined,
  bookingType: "one_way",
  date: "",
  startTime: "09:00",
  endDate: "",
  endTime: "11:00",
  returnDate: "",
  returnTime: "14:00",
  passengerCount: 1,
  noOfVehicles: 1,
  vehicleType: "Coach",
  bookingDetails: "",
  timeZone: "Australia/Sydney",
  pickup: { address: "" },
  dropoff: { address: "" },
  stops: [] as StructuredLocation[],
  recurrenceRule: {
    type: "weekly",
    days: [1, 2, 3, 4, 5],
    startDate: "",
    endDate: "",
  },
};

export const INITIAL_LINE_ITEMS: QuotationLineItem[] = [
  {
    description: "Transport service",
    quantity: 1,
    unitPriceMinor: 0,
  },
];
