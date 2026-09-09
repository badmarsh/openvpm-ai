import { describe, it, expect } from "vitest";
import { assertAgentRole, type AgentUserRole } from "../authorization";

/** Creates a minimal context object for testing. */
function ctx(role: unknown): { userRole?: string | null } {
  return { userRole: role as string | null | undefined };
}

const PRESCRIPTION_ROLES: readonly AgentUserRole[] = ["veterinarian", "admin"];
const CS_LOG_ROLES: readonly AgentUserRole[] = ["veterinarian", "admin"];
const CLINICAL_ROLES: readonly AgentUserRole[] = ["veterinarian", "admin"];
const ALL_STAFF_ROLES: readonly AgentUserRole[] = [
  "admin",
  "veterinarian",
  "technician",
  "front_desk",
];

describe("assertAgentRole — fail-closed authorization boundary", () => {
  // ─────────────────────────────────────────────────────────────────────
  // DENY: absent / malformed roles — must NEVER pass regardless of allowed list
  // ─────────────────────────────────────────────────────────────────────
  describe("DENY: absent/malformed roles", () => {
    it("denies undefined role", () => {
      expect(() => assertAgentRole(ctx(undefined), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies null role", () => {
      expect(() => assertAgentRole(ctx(null), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies empty string role", () => {
      expect(() => assertAgentRole(ctx(""), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies whitespace-only role", () => {
      expect(() => assertAgentRole(ctx("   "), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies undefined against an all-staff allowed list", () => {
      // Previously the fail-open pattern would allow this through
      expect(() => assertAgentRole(ctx(undefined), ALL_STAFF_ROLES)).toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // DENY: unknown roles — not in the known AgentUserRole union
  // ─────────────────────────────────────────────────────────────────────
  describe("DENY: unknown/legacy role strings", () => {
    it("denies unknown role 'superuser'", () => {
      expect(() => assertAgentRole(ctx("superuser"), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies legacy role 'portal_user' (not a staff role)", () => {
      expect(() => assertAgentRole(ctx("portal_user"), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies legacy role 'service_cron'", () => {
      expect(() => assertAgentRole(ctx("service_cron"), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies role injection attempt (SQL-like string)", () => {
      expect(() => assertAgentRole(ctx("'; DROP TABLE users; --"), CLINICAL_ROLES)).toThrow();
    });

    it("denies role injection attempt (JSON-like string)", () => {
      expect(() => assertAgentRole(ctx('{"role":"admin"}'), CLINICAL_ROLES)).toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // DENY: known but insufficient roles for privileged operations
  // ─────────────────────────────────────────────────────────────────────
  describe("DENY: known roles without required permission", () => {
    it("denies 'front_desk' for prescription creation", () => {
      expect(() => assertAgentRole(ctx("front_desk"), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies 'technician' for prescription creation", () => {
      expect(() => assertAgentRole(ctx("technician"), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies 'viewer' for prescription creation", () => {
      expect(() => assertAgentRole(ctx("viewer"), PRESCRIPTION_ROLES)).toThrow();
    });

    it("denies 'front_desk' for controlled substances log", () => {
      expect(() => assertAgentRole(ctx("front_desk"), CS_LOG_ROLES)).toThrow();
    });

    it("denies 'technician' for controlled substances log", () => {
      expect(() => assertAgentRole(ctx("technician"), CS_LOG_ROLES)).toThrow();
    });

    it("denies 'viewer' for controlled substances log", () => {
      expect(() => assertAgentRole(ctx("viewer"), CS_LOG_ROLES)).toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // ALLOW: properly authorized roles
  // ─────────────────────────────────────────────────────────────────────
  describe("ALLOW: authorized roles must not throw", () => {
    it("allows 'veterinarian' for prescription creation", () => {
      expect(() => assertAgentRole(ctx("veterinarian"), PRESCRIPTION_ROLES)).not.toThrow();
    });

    it("allows 'admin' for prescription creation", () => {
      expect(() => assertAgentRole(ctx("admin"), PRESCRIPTION_ROLES)).not.toThrow();
    });

    it("allows 'veterinarian' for controlled substances log", () => {
      expect(() => assertAgentRole(ctx("veterinarian"), CS_LOG_ROLES)).not.toThrow();
    });

    it("allows 'admin' for controlled substances log", () => {
      expect(() => assertAgentRole(ctx("admin"), CS_LOG_ROLES)).not.toThrow();
    });

    it("allows 'front_desk' when listed in allowedRoles", () => {
      expect(() => assertAgentRole(ctx("front_desk"), ALL_STAFF_ROLES)).not.toThrow();
    });

    it("allows 'technician' when listed in allowedRoles", () => {
      expect(() => assertAgentRole(ctx("technician"), ALL_STAFF_ROLES)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Error structure — must carry { code: "FORBIDDEN" }
  // ─────────────────────────────────────────────────────────────────────
  describe("Error structure", () => {
    it("thrown error has code property set to FORBIDDEN", () => {
      let thrown: unknown;
      try {
        assertAgentRole(ctx(undefined), PRESCRIPTION_ROLES);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect((thrown as { code?: string }).code).toBe("FORBIDDEN");
    });

    it("thrown error is an Error instance", () => {
      expect(() => assertAgentRole(ctx(null), PRESCRIPTION_ROLES)).toThrowError(Error);
    });

    it("error message for unknown role identifies the offending role value", () => {
      let thrown: unknown;
      try {
        assertAgentRole(ctx("hacker_role"), PRESCRIPTION_ROLES);
      } catch (e) {
        thrown = e;
      }
      expect((thrown as Error).message).toContain("hacker_role");
    });

    it("error message for insufficient role identifies the role and required roles", () => {
      let thrown: unknown;
      try {
        assertAgentRole(ctx("front_desk"), PRESCRIPTION_ROLES);
      } catch (e) {
        thrown = e;
      }
      const msg = (thrown as Error).message;
      expect(msg).toContain("front_desk");
      expect(msg).toContain("veterinarian");
    });

    it("includes resourceDescription in error message when provided", () => {
      let thrown: unknown;
      try {
        assertAgentRole(ctx(undefined), PRESCRIPTION_ROLES, "Custom resource description");
      } catch (e) {
        thrown = e;
      }
      expect((thrown as Error).message).toContain("Custom resource description");
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Regression: the old fail-open pattern was `if (ctx.userRole && !list.includes(...))`
  // which evaluated to false (skipped check) when userRole was undefined.
  // These tests prove that the fix is effective.
  // ─────────────────────────────────────────────────────────────────────
  describe("Regression: old fail-open pattern was bypassed by undefined role", () => {
    function oldFailOpenCheck(userRole: string | undefined, allowedRoles: string[]): void {
      // This is the OLD vulnerable pattern — kept here only to document the issue
      if (userRole && !allowedRoles.includes(userRole)) {
        throw new Error("Denied");
      }
    }

    it("demonstrates the old pattern allowed undefined role through (the bug)", () => {
      // This must NOT throw with the old pattern — it was the vulnerability
      expect(() => oldFailOpenCheck(undefined, ["veterinarian", "admin"])).not.toThrow();
    });

    it("new assertAgentRole correctly denies undefined role (the fix)", () => {
      // This MUST throw with the new pattern
      expect(() => assertAgentRole(ctx(undefined), ["veterinarian", "admin"])).toThrow();
    });
  });
});
