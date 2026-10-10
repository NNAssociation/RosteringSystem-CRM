/**
 * Feature flags — controlled via environment variables.
 * Use these to gate new features behind flags for safe rollout.
 */
export const FEATURES = {
  NOTICES: process.env.NEXT_PUBLIC_NOTICES_ENABLED === "true",
  INCIDENTS: process.env.NEXT_PUBLIC_INCIDENTS_ENABLED === "true",
  LOST_PROPERTY: process.env.NEXT_PUBLIC_LOST_PROPERTY_ENABLED === "true",
  /** Enables the Dispatch Board module in navigation and routing */
  DISPATCH_BOARD: process.env.NEXT_PUBLIC_DISPATCH_ENABLED !== "false",
} as const;
