/**
 * Role-Based Access Control (RBAC) for Rhea SaaS.
 *
 * Role hierarchy: OWNER > ADMIN > {OPERATOR, CLIENT} > VIEWER
 * Each role inherits all permissions of roles below it.
 *
 * CLIENT is a peer of OPERATOR, not below it: they share the same hierarchy
 * level (1), so hasMinRole(CLIENT, "OPERATOR") is true and vice versa. CLIENT
 * exists so a client-side user can request and preview site changes without
 * being able to publish or manage assignments; those gates are expressed as
 * explicit actions requiring "ADMIN" (see tasks:publish, assignments:manage
 * below), not as a hasMinRole(role, "OPERATOR") check, which CLIENT would
 * also pass.
 */

export type Role = "OWNER" | "ADMIN" | "OPERATOR" | "CLIENT" | "VIEWER";

export type Action =
  | "incidents:read"
  | "incidents:write"
  | "connectors:manage"
  | "members:manage"
  | "members:invite"
  | "agent:execute"
  | "mutations:approve"
  | "org:settings"
  | "org:delete"
  | "apikeys:manage"
  | "tasks:request"
  | "tasks:discard"
  | "tasks:publish"
  | "assignments:manage";

const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  CLIENT: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * Permission matrix: each action requires a minimum role level.
 */
const ACTION_REQUIREMENTS: Record<Action, Role> = {
  "incidents:read": "VIEWER",
  "incidents:write": "OPERATOR",
  "agent:execute": "OPERATOR",
  "mutations:approve": "OPERATOR",
  "members:invite": "ADMIN",
  "members:manage": "ADMIN",
  "connectors:manage": "ADMIN",
  "apikeys:manage": "ADMIN",
  "org:settings": "ADMIN",
  "org:delete": "OWNER",
  "tasks:request": "OPERATOR",
  "tasks:discard": "OPERATOR",
  "tasks:publish": "ADMIN",
  "assignments:manage": "ADMIN",
};

/**
 * Check if a role has permission to perform an action.
 */
export function hasPermission(role: Role, action: Action): boolean {
  const requiredLevel = ROLE_HIERARCHY[ACTION_REQUIREMENTS[action]];
  const userLevel = ROLE_HIERARCHY[role];
  return userLevel >= requiredLevel;
}

/**
 * Throw if the user's role is insufficient for the action.
 */
export function requirePermission(role: string | undefined, action: Action): void {
  if (!role || !hasPermission(role as Role, action)) {
    throw new Error(
      `Forbidden: role "${role || "none"}" cannot perform "${action}"`
    );
  }
}

/**
 * Check if a role meets or exceeds a minimum role level.
 */
export function hasMinRole(role: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

/**
 * All available roles for UI dropdowns.
 */
export const ALL_ROLES: { value: Role; label: string; description: string }[] = [
  { value: "OWNER", label: "Owner", description: "Full org control including billing and deletion" },
  { value: "ADMIN", label: "Admin", description: "Manage members, connectors, and settings" },
  { value: "OPERATOR", label: "Operator", description: "Run agent sessions and approve mutations" },
  { value: "CLIENT", label: "Client", description: "Client: request and preview site changes" },
  { value: "VIEWER", label: "Viewer", description: "Read-only access to incidents and dashboards" },
];
