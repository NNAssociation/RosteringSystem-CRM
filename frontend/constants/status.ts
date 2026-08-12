export const STATUS = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
    ON_TRIP: "On Trip",
    MAINTENANCE: "Maintenance",
    AVAILABLE: "Available"
} as const;

export const ASSIGNMENT_STATUS = {
    PENDING: "PENDING",
    CONFIRMED: "CONFIRMED",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
} as const;

export const JOB_STATUS = {
    UNASSIGNED: "UNASSIGNED",
    ASSIGNED: "ASSIGNED",
    EN_ROUTE: "EN_ROUTE",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
} as const;

export type StatusValue = typeof STATUS[keyof typeof STATUS];
export type AssignmentStatusValue = typeof ASSIGNMENT_STATUS[keyof typeof ASSIGNMENT_STATUS];
export type JobStatusValue = typeof JOB_STATUS[keyof typeof JOB_STATUS];
