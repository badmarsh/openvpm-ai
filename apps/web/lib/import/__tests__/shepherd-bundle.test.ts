import { describe, expect, it } from "vitest";
import {
  SHEPHERD_MIGRATION_POLICY,
  classifyShepherdDictionaryRows,
  classifyShepherdHeaders,
  summarizeShepherdTableCounts,
} from "../shepherd-bundle";

describe("Shepherd bundle contract", () => {
  it("recognizes high-value tables from schema instead of a clinic filename", () => {
    expect(
      classifyShepherdHeaders([
        "Id",
        "FirstName",
        "LastName",
        "ClientStatusId",
        "Deleted",
      ]),
    ).toEqual({ status: "matched", kind: "client" });
    expect(
      classifyShepherdHeaders([
        "Id",
        "PatientId",
        "ProductId",
        "VaccineName",
        "AdministrationDate",
        "DueDate",
        "LotNumber",
      ]),
    ).toEqual({ status: "matched", kind: "vaccination" });
  });

  it("fails closed when shared dictionary headers are ambiguous", () => {
    const result = classifyShepherdHeaders([
      "Id",
      "Description",
      "SortOrder",
      "Abrv",
      "Name",
    ]);
    expect(result.status).toBe("ambiguous");
  });

  it("resolves a shared dictionary only from an allowlisted vocabulary", () => {
    expect(
      classifyShepherdDictionaryRows([
        { Id: "synthetic-1", Name: "Active" },
        { Id: "synthetic-2", Name: "Inactive" },
        { Id: "synthetic-3", Name: "Deceased" },
      ]),
    ).toEqual({ status: "matched", kind: "patient_status" });
    expect(
      classifyShepherdDictionaryRows([
        { Id: "synthetic-1", Name: "Canary custom" },
      ]),
    ).toEqual({ status: "unknown" });
  });

  it("requires non-negative integer counts and combines repeated table kinds", () => {
    expect(
      summarizeShepherdTableCounts([
        { kind: "client", rows: 2 },
        { kind: "client", rows: 3 },
      ]).client,
    ).toBe(5);
    expect(() =>
      summarizeShepherdTableCounts([{ kind: "patient", rows: -1 }]),
    ).toThrow(/non-negative integers/);
  });

  it("documents every high-risk domain with an explicit disposition", () => {
    const policy = new Map(
      SHEPHERD_MIGRATION_POLICY.map((item) => [item.domain, item]),
    );
    expect(policy.get("clients")?.disposition).toBe("import_now");
    expect(policy.get("care_reminders")?.disposition).toBe(
      "build_generic_support",
    );
    expect(policy.get("financial_history")?.disposition).toBe("reference_only");
    expect(policy.get("platform_configuration")?.disposition).toBe("exclude");
    expect(
      [...policy.values()].every((item) => item.reusableForOtherClinics),
    ).toBe(true);
  });
});
