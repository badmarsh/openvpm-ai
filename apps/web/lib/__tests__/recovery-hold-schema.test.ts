import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { practices } from "@openpims/db";

describe("practice recovery hold schema", () => {
  it("persists a default-off hold with required evidence when active", () => {
    expect(practices.recoveryHold.notNull).toBe(true);
    expect(practices.recoveryHold.hasDefault).toBe(true);
    expect(practices.recoveryHoldReason.notNull).toBe(false);
    expect(practices.recoveryHoldSetAt.notNull).toBe(false);

    const checks = getTableConfig(practices).checks.map(
      (constraint) => constraint.name,
    );
    expect(checks).toContain("practices_recovery_hold_evidence_check");
  });

  it("uses an expand-only NOT VALID migration", () => {
    const migration = readFileSync(
      "../../packages/db/drizzle/0082_overconfident_manta.sql",
      "utf8",
    );
    expect(migration).toContain("Expand-only recovery hold");
    expect(migration).toContain('ADD COLUMN "recovery_hold"');
    expect(migration).toContain(
      'ADD CONSTRAINT "practices_recovery_hold_evidence_check"',
    );
    expect(migration).toContain("NOT VALID");
  });
});
