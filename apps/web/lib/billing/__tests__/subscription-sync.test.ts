import { describe, expect, it } from "vitest";
import { countBillableStaffRows } from "../subscription-sync";

describe("countBillableStaffRows", () => {
  it("counts every non-deleted staff user and excludes deleted users", () => {
    expect(
      countBillableStaffRows([
        { deletedAt: null },
        {},
        { deletedAt: new Date("2026-06-01T00:00:00Z") },
        { deletedAt: "2026-06-02T00:00:00Z" },
      ])
    ).toBe(2);
  });
});
