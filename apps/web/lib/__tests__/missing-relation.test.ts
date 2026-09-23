import { describe, expect, it } from "vitest";
import { isMissingRelationError } from "@/lib/db/missing-relation";

describe("isMissingRelationError", () => {
  it("matches a nested Postgres undefined_table error", () => {
    const err = {
      message: 'Failed query: select ...',
      cause: {
        code: "42P01",
        message: 'relation "ext_inventory_metadata" does not exist',
      },
    };
    expect(isMissingRelationError(err, "ext_inventory_metadata")).toBe(true);
    expect(isMissingRelationError(err, "products")).toBe(false);
  });

  it("ignores unrelated failures", () => {
    expect(
      isMissingRelationError(new Error("connection refused"), "ext_inventory_metadata"),
    ).toBe(false);
  });
});
