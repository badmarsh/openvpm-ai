/**
 * Authorization Boundary — Agent Tool Layer
 *
 * This module is the single authorization boundary for all agent tool role
 * checks. Never use ad-hoc `if (ctx.userRole && !allowedRoles.includes(...))`
 * patterns — those are fail-OPEN: when `userRole` is undefined/null the
 * condition evaluates to false and the check is bypassed entirely.
 *
 * `assertAgentRole` defaults to DENY for:
 *   - absent role (undefined / null)
 *   - empty string role
 *   - whitespace-only role
 *   - unknown role (not in the known AgentUserRole union)
 *   - role not in the allowedRoles list
 *
 * The tRPC `requireRole()` middleware in server/trpc.ts handles the staff
 * session boundary; this module handles the agent tool layer.
 */

/**
 * All valid agent user roles. Unknown strings are rejected.
 * This list mirrors the UserRole union in server/trpc.ts.
 */
export type AgentUserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer";

export const ALL_AGENT_ROLES: readonly AgentUserRole[] = [
  "admin",
  "veterinarian",
  "technician",
  "front_desk",
  "viewer",
];

/**
 * Asserts that `ctx.userRole` is a known, non-empty role AND is in the
 * `allowedRoles` list. Throws a structured FORBIDDEN error on any violation.
 *
 * @param ctx - Any object with an optional `userRole` field
 * @param allowedRoles - Roles permitted for this operation
 * @param resourceDescription - Optional human-readable description for the error message
 */
export function assertAgentRole(
  ctx: { userRole?: string | null },
  allowedRoles: readonly AgentUserRole[],
  resourceDescription?: string,
): void {
  const role = ctx.userRole;

  // DENY: missing, null, or empty string — never treat absence as allowed
  if (!role || role.trim() === "") {
    throw Object.assign(
      new Error(
        [
          "Access denied: an authenticated role is required.",
          resourceDescription,
        ]
          .filter(Boolean)
          .join(" "),
      ),
      { code: "FORBIDDEN" as const },
    );
  }

  // DENY: unknown role (not in the known role union)
  if (!ALL_AGENT_ROLES.includes(role as AgentUserRole)) {
    throw Object.assign(
      new Error(
        [
          `Access denied: unknown role "${role}".`,
          resourceDescription,
        ]
          .filter(Boolean)
          .join(" "),
      ),
      { code: "FORBIDDEN" as const },
    );
  }

  // DENY: role not in the allowed list for this operation
  if (!allowedRoles.includes(role as AgentUserRole)) {
    throw Object.assign(
      new Error(
        [
          `Access denied: role "${role}" is not authorized for this operation.`,
          `Requires one of: ${allowedRoles.join(", ")}.`,
          resourceDescription,
        ]
          .filter(Boolean)
          .join(" "),
      ),
      { code: "FORBIDDEN" as const },
    );
  }
}
