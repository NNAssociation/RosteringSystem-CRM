/**
 * Feature flags — controlled via environment variables.
 * Use these to gate new features behind flags for safe rollout.
 */
export const FEATURES = {
  /** Enables the Dispatch Board module in navigation and routing */
  DISPATCH_BOARD: process.env.NEXT_PUBLIC_DISPATCH_ENABLED !== "false",
} as const;
