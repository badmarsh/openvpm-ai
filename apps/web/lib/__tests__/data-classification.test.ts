import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  DATA_SENSITIVITY_LEVELS,
  DEFAULT_DATA_SENSITIVITY_LEVELS,
  appointments,
  clients,
  dataSensitivityLevelEnum,
  patients,
  soapNotes,
} from "@openpims/db";

function readRepoFile(path: string): string {
  return readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8");
}

describe("P0-L05 data classification contract", () => {
  it("defines the four ordered policy labels", () => {
    expect(DATA_SENSITIVITY_LEVELS).toEqual([
      "PUBLIC",
      "INTERNAL",
      "CONFIDENTIAL",
      "STRICTLY_CONFIDENTIAL",
    ]);
    expect(dataSensitivityLevelEnum.enumValues).toEqual(
      DATA_SENSITIVITY_LEVELS,
    );
    expect(DEFAULT_DATA_SENSITIVITY_LEVELS).toEqual({
      clients: "CONFIDENTIAL",
      patients: "STRICTLY_CONFIDENTIAL",
      appointments: "STRICTLY_CONFIDENTIAL",
      soapNotes: "STRICTLY_CONFIDENTIAL",
    });
  });

  it.each([
    ["clients", clients],
    ["patients", patients],
    ["appointments", appointments],
    ["soap_notes", soapNotes],
  ])("adds a non-null data_sensitivity_level to %s", (_name, table) => {
    const column = getTableConfig(table).columns.find(
      (candidate) => candidate.name === "data_sensitivity_level",
    );

    expect(column).toBeDefined();
    expect(column?.notNull).toBe(true);
    expect(column?.hasDefault).toBe(true);
    expect(column?.enumValues).toEqual(DATA_SENSITIVITY_LEVELS);
  });

  it("ships the migration with safe defaults and downgrade protection", () => {
    const migration = readRepoFile(
      "packages/db/drizzle/0107_data_classification_labels.sql",
    );

    expect(migration).toContain(
      'CREATE TYPE "public"."data_sensitivity_level" AS ENUM',
    );
    expect(migration).toContain(
      'ALTER TABLE "clients"\n  ADD COLUMN "data_sensitivity_level"',
    );
    expect(migration).toContain(
      "DEFAULT 'CONFIDENTIAL' NOT NULL",
    );
    expect(migration).toContain(
      'ALTER TABLE "patients"\n  ADD COLUMN "data_sensitivity_level"',
    );
    expect(migration).toContain(
      "DEFAULT 'STRICTLY_CONFIDENTIAL' NOT NULL",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.prevent_data_sensitivity_downgrade()",
    );
    expect(migration).toContain("session_user = 'openpims_app'");
    expect(migration).toContain("ERRCODE = '42501'");
  });

  it("keeps classification metadata behind the existing tenant RLS boundary", () => {
    const rls = readRepoFile("packages/db/rls/enable-rls.sql");

    expect(rls).toContain("'clients'");
    expect(rls).toContain("'patients'");
    expect(rls).toContain("'appointments'");
    expect(rls).toContain("'soap_notes'");
    expect(rls).toContain(
      "Data classification is metadata, not an authorization boundary",
    );
    expect(rls).toContain(
      "REVOKE ALL ON FUNCTION public.prevent_data_sensitivity_downgrade()",
    );
  });
});
