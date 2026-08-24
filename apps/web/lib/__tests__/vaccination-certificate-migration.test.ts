import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");
const migration = readFileSync(
  resolve(
    repoRoot,
    "packages/db/drizzle/0096_vaccination_certificates_care_reminder_dismissal.sql",
  ),
  "utf8",
);

describe("vaccination certificate and reminder dismissal migration", () => {
  it("replaces the care reminder enum transaction-safely", () => {
    expect(migration).toContain(
      "CREATE TYPE \"public\".\"care_reminder_status_v2\" AS ENUM('open', 'completed', 'dismissed')",
    );
    expect(migration).toContain(
      'ALTER TABLE "care_reminders" ALTER COLUMN "status" TYPE "public"."care_reminder_status_v2" USING "status"::text::"public"."care_reminder_status_v2"',
    );
    expect(migration).not.toContain("ADD VALUE");
    expect(
      migration.indexOf('DROP CONSTRAINT "care_reminders_state_check"'),
    ).toBeLessThan(
      migration.indexOf('DROP TYPE "public"."care_reminder_status"'),
    );
    expect(
      migration.indexOf('DROP INDEX "care_reminders_open_due_idx"'),
    ).toBeLessThan(migration.indexOf('ALTER COLUMN "status" TYPE'));
    expect(
      migration.indexOf('CREATE INDEX "care_reminders_open_due_idx"'),
    ).toBeGreaterThan(
      migration.indexOf(
        'ALTER TYPE "public"."care_reminder_status_v2" RENAME TO "care_reminder_status"',
      ),
    );
  });

  it("adds tenant-bound attribution and coherent state constraints", () => {
    expect(migration).toContain("care_reminders_dismisser_tenant_fk");
    expect(migration).toContain("care_reminders_dismissal_reason_check");
    expect(migration).toContain("care_reminders_state_check");
    expect(migration).toContain("\"status\" = 'dismissed'");
    expect(migration).toContain('"dismissed_by" is not null');
  });

  it("adds bounded rabies evidence and a same-practice veterinarian reference", () => {
    for (const column of [
      "product_name",
      "product_expiration_date",
      "dose_type",
      "licensed_duration_months",
      "rabies_tag_number",
      "supervising_veterinarian_id",
    ]) {
      expect(migration).toContain(`ADD COLUMN "${column}"`);
    }
    expect(migration).toContain("vaccination_records_supervisor_practice_fk");
    expect(migration).toContain("vaccination_records_licensed_duration_check");
    expect(migration).toContain("between 1 and 120");
  });
});
