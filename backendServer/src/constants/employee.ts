// ── Employee Constants ─────────────────────────────────────
// Single source of truth for Role ↔ Department mapping.
// Role is the primary field; Department is always auto-derived.

export const ROLE_DEPARTMENT_MAP: Record<string, string> = {
  DRIVER: 'OPERATION',
  DISPATCHER: 'OPERATION',
  MECHANIC: 'OPERATION',
  ADMIN: 'ADMINISTRATION',
  MANAGER: 'MANAGEMENT',
};

export const ROLES = ['DRIVER', 'DISPATCHER', 'MECHANIC', 'ADMIN', 'MANAGER'] as const;
export const DEPARTMENTS = ['OPERATION', 'ADMINISTRATION', 'MANAGEMENT'] as const;
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT'] as const;
export const STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const;

/** Derive the correct department for a given role */
export function getDepartmentForRole(role: string): string {
  return ROLE_DEPARTMENT_MAP[role] ?? 'OPERATION';
}
