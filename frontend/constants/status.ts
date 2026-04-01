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

export type StatusValue = typeof STATUS[keyof typeof STATUS];
