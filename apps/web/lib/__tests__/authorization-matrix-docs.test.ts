import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_AGENT_ROLES } from "../authorization";

/**
 * GT-015 guard. The authorization matrix is labelled "Canonical Security
 * Reference", so a role it names that does not exist in code is worse than no
 * document at all: during an incident it sends the reader chasing a role that
 * can never authenticate, and it hides a real role that can.
 *
 * The previous revision of the document listed `portal_user` and `service_cron`
 * (neither exists as a `UserRole`) and omitted `viewer` entirely.
 */

const MATRIX_PATH = "../../docs/authorization-matrix.md";

function readMatrix(): string {
  return readFileSync(MATRIX_PATH, "utf8");
}

/** The role taxonomy table lives under "## 2. Global Role Taxonomy". */
function roleTableSection(matrix: string): string {
  const start = matrix.indexOf("## 2. Global Role Taxonomy");
  expect(start, "matrix lost its '## 2. Global Role Taxonomy' section").toBeGreaterThan(-1);

  const end = matrix.indexOf("\n## ", start + 1);
  return matrix.slice(start, end === -1 ? matrix.length : end);
}

/** Every `` `role` `` identifier in a backtick span inside the role table. */
function documentedRoles(matrix: string): string[] {
  const section = roleTableSection(matrix);
  const tableRows = section
    .split("\n")
    .filter((line) => line.trim().startsWith("| `"));

  const roles = new Set<string>();
  for (const row of tableRows) {
    const cells = row.split("|");
    // The first cell of a taxonomy row is the role identifier itself.
    const identifier = cells[1]?.trim() ?? "";
    const match = /^`([a-z_]+)`$/.exec(identifier);
    if (match?.[1]) roles.add(match[1]);
  }
  return [...roles].sort();
}

describe("docs/authorization-matrix.md matches the code", () => {
  it("documents exactly the roles that exist in AgentUserRole", () => {
    expect(documentedRoles(readMatrix())).toEqual([...ALL_AGENT_ROLES].sort());
  });

  it("names no role the code would reject", () => {
    const known = new Set<string>(ALL_AGENT_ROLES);
    for (const role of documentedRoles(readMatrix())) {
      expect(known.has(role), `matrix documents unknown role "${role}"`).toBe(true);
    }
  });

  it("keeps the phantom roles explained rather than silently dropped", () => {
    // portal_user / service_cron are not roles. The matrix must say so out loud,
    // otherwise the next reader re-adds them.
    const matrix = readMatrix();
    expect(matrix).toContain("portal_user");
    expect(matrix).toContain("service_cron");
    expect(matrix).toMatch(/neexistuje/i);
  });

  it("does not grant technicians SOAP draft writes or voice dictation", () => {
    // Both are requireRole("admin","veterinarian") in code:
    //   apps/web/server/routers/records.ts:1750-1751
    //   apps/web/server/routers/extensions/voice.ts:46-47
    const matrix = readMatrix();
    expect(matrix).toContain("saveSoapDraft");
    expect(matrix).toContain("voiceProcedure");

    const domainRows = matrix
      .split("\n")
      .filter((line) => /^\|\s*\*\*(Clinical SOAP Notes \(Drafts\)|AI Voice Dictation)/.test(line.trim()));

    expect(domainRows, "matrix lost a row guarded in code").toHaveLength(2);
    for (const row of domainRows) {
      // Columns are: resource, admin, veterinarian, technician, front desk, viewer.
      const technician = row.split("|")[4]?.trim();
      expect(technician, `technician must be denied in: ${row}`).toBe("❌ DENIED");
    }
  });

  it("documents the read-only viewer role", () => {
    // viewer is real (trpc.ts:36) and blocks mutations globally (trpc.ts:501).
    expect(ALL_AGENT_ROLES).toContain("viewer");
    expect(readMatrix()).toContain("`viewer`");
  });
});
