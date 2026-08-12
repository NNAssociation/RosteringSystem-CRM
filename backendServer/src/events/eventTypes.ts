/**
 * Domain event types for cross-service communication.
 * All events follow the pattern: ENTITY.ACTION
 */
export const EventTypes = {
  // Booking events
  BOOKING_CREATED: "booking.created",
  BOOKING_UPDATED: "booking.updated",
  BOOKING_CANCELLED: "booking.cancelled",
  BOOKING_CONFIRMED: "booking.confirmed",

  // Job events
  JOB_CREATED: "job.created",
  JOB_UPDATED: "job.updated",
  JOB_CANCELLED: "job.cancelled",

  // Assignment events
  ASSIGNMENT_CREATED: "assignment.created",
  ASSIGNMENT_UPDATED: "assignment.updated",
  ASSIGNMENT_CANCELLED: "assignment.cancelled",
  ASSIGNMENT_COMPLETED: "assignment.completed",

  // Driver events
  DRIVER_AVAILABILITY_CHANGED: "driver.availability_changed",
  DRIVER_FATIGUE_WARNING: "driver.fatigue_warning",

  // Fleet events
  VEHICLE_STATUS_CHANGED: "vehicle.status_changed",

  // Dispatch events
  DISPATCH_LOCK_ACQUIRED: "dispatch.lock_acquired",
  DISPATCH_LOCK_RELEASED: "dispatch.lock_released",
  DISPATCH_CONFLICT_DETECTED: "dispatch.conflict_detected",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export interface DomainEvent<T = any> {
  type: EventType;
  payload: T;
  timestamp: Date;
  userId?: number | undefined;
  requestId?: string | undefined;
}
