import type { StructuredLocation } from "./index";

export type BookingCategory = "one_way" | "round_trip" | "repeatable";

export interface RecurrenceRule {
  type: "daily" | "weekly" | "monthly" | string;
  days: number[];
  startDate: string;
  endDate: string;
}

export interface RouteDirection {
  geometry: { type: "LineString"; coordinates: number[][] };
  distanceMeters: number;
  drivingSeconds: number;
  coachDrivingSeconds: number;
  stopSeconds: number;
  serviceSeconds: number;
}
export interface RouteCalculation {
  status: "VALID" | "OUTDATED";
  fingerprint: string;
  provider?: string;
  calculatedAt?: string;
  outbound?: RouteDirection;
  return?: RouteDirection;
  error?: string;
  previous?: RouteCalculation;
}
export interface RouteReview {
  fingerprint: string;
  action: "KEEP" | "RECALCULATED";
}
export interface BookingTrip {
  outboundItinerary?: StructuredLocation[];
  routeCalculation?: RouteCalculation | null;
  returnEndDate: string;
  returnEndTime: string;
  returnItinerary: StructuredLocation[];
  returnItineraryConfirmed: boolean;
  subject: string;
  customerName: string;
  customerEmail: string;
  customerId?: number;
  bookingType: BookingCategory;
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
  returnDate: string;
  returnTime: string;
  passengerCount: number;
  noOfVehicles: number;
  vehicleType?: "Coach" | "Bus";
  bookingDetails: string;
  timeZone: string;
  pickup: StructuredLocation;
  dropoff: StructuredLocation;
  stops: StructuredLocation[];
  recurrenceRule: RecurrenceRule;
  estimatedDistanceKm?: number;
  estimatedDurationMinutes?: number;
}

export interface QuotationLineItem {
  id?: number;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor?: number;
}

export interface QuotationDelivery {
  id: string;
  quotationId: number;
  kind: "QUOTATION" | "RESPONSE" | string;
  recipient: string;
  status:
    | "QUEUED"
    | "SENT"
    | "DELIVERED"
    | "OPENED"
    | "CLICKED"
    | "BOUNCED"
    | "BLOCKED"
    | "FAILED"
    | "UNKNOWN"
    | "RETRIED"
    | string;
  attempts: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationSnapshot {
  routeReview?: RouteReview;
  customerName?: string;
  customerEmail?: string;
  subject?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  [key: string]: unknown;
}

export interface QuotationRevision {
  id: number;
  bookingId: number;
  revision: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "SUPERSEDED" | string;
  currency: string;
  discountMinor: number;
  taxBasisPoints: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  expiresAt: string;
  terms: string;
  message: string;
  snapshot: QuotationSnapshot;
  tokenHash?: string | null;
  sentAt?: string | null;
  respondedAt?: string | null;
  respondentName?: string | null;
  responseReason?: string | null;
  createdAt: string;
  items: QuotationLineItem[];
  deliveries?: QuotationDelivery[];
}

export interface QuotationConfig {
  timeZone: string;
  currency: string;
  taxBasisPoints: number;
  validityDays: number;
  emailConfigured: boolean;
  defaultTerms?: string;
  charterPricing?: any;
}

export interface ActivityEntry {
  id: number;
  action: string;
  entity: string;
  entityId: number;
  changes?: Record<string, unknown> | null;
  userId?: number | null;
  timestamp: string;
}

export interface DispatchJobAssignment {
  id: number;
  status: string;
  driver?: { firstName?: string; lastName?: string } | null;
  vehicle?: { licensePlate?: string } | null;
}

export interface DispatchJobSummary {
  id: number;
  status: string;
  jobStartLocation?: string | null;
  jobEndLocation?: string | null;
  jobStartDateTime?: string | null;
  jobEndDateTime?: string | null;
  assignments?: DispatchJobAssignment[];
}

export interface BookingRecord {
  outboundItinerary?: StructuredLocation[];
  returnItinerary?: StructuredLocation[];
  returnItineraryConfirmed?: boolean;
  routeCalculation?: RouteCalculation | null;
  id: number;
  subject: string;
  inquiryDetails?: string | null;
  bookingDetails?: string | null;
  status: "OPEN" | "CONFIRMED" | "CANCELLED" | "SUPERSEDED" | "DRAFT" | string;
  dispatchStatus?:
    | "NOT_READY"
    | "READY"
    | "ALLOCATED"
    | "DISPATCHED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | string;
  createdAt: string;
  updatedAt: string;
  noOfVehicles?: number;
  passengerCount?: number;
  tripCount?: number;
  startDateTime?: string;
  startLocation?: string;
  endLocation?: string;
  endDateTime?: string | null;
  bookingType: BookingCategory;
  pickupLocation: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupPlaceId?: string | null;
  dropoffLocation: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffPlaceId?: string | null;
  returnDateTime?: string | null;
  returnEndDateTime?: string | null;
  waitingDuration?: number | null;
  recurrenceRule?: RecurrenceRule | null;
  customerId: number;
  customer?: {
    id: number;
    name?: string | null;
    email: string;
    phone1?: string | null;
    company?: string | null;
  };
  customerName?: string;
  customerEmail?: string;
  timeZone: string;
  startTime?: string;
  endTime?: string;
  returnTime?: string;
  stops?: StructuredLocation[] | null;
  confirmedAt?: string | null;
  confirmationSource?: string | null;
  amendsBookingId?: number | null;
  revision: number;
  quotations?: QuotationRevision[];
  jobs?: DispatchJobSummary[];
}
