// ── Employee Constants ─────────────────────────────────────
// Single source of truth for Role ↔ Department mapping.
// Role is the primary field; Department is always auto-derived.

export const ROLE_DEPARTMENT_MAP = {
  DRIVER: 'OPERATION',
  DISPATCHER: 'OPERATION',
  MECHANIC: 'OPERATION',
  ADMIN: 'ADMINISTRATION',
  MANAGER: 'MANAGEMENT',
} as const;

export type EmployeeRole = keyof typeof ROLE_DEPARTMENT_MAP;
export type Department = (typeof ROLE_DEPARTMENT_MAP)[EmployeeRole];

export const ROLES = Object.keys(ROLE_DEPARTMENT_MAP) as EmployeeRole[];
export const DEPARTMENTS = ['OPERATION', 'ADMINISTRATION', 'MANAGEMENT'] as const;
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT'] as const;
export const STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const;

/** Derive the correct department for a given role */
export function getDepartmentForRole(role: string): string {
  return ROLE_DEPARTMENT_MAP[role as EmployeeRole] ?? 'OPERATION';
}

/** Check if a role requires driver license fields */
export function isDriverRole(role: string): boolean {
  return role === 'DRIVER';
}

// ── Display Labels ─────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  DRIVER: 'Driver',
  DISPATCHER: 'Dispatcher',
  MECHANIC: 'Mechanic',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
};

export const DEPARTMENT_LABELS: Record<string, string> = {
  OPERATION: 'Operations',
  ADMINISTRATION: 'Administration',
  MANAGEMENT: 'Management',
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Deactivated',
  ON_LEAVE: 'On Leave',
};
