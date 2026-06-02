import { describe, it, expect } from "vitest";
import { summarizePlanProgress } from "../progress";

describe("summarizePlanProgress", () => {
  it("returns zeros for an empty plan", () => {
    expect(summarizePlanProgress([])).toEqual({
      total: 0,
      done: 0,
      skipped: 0,
      active: 0,
      percentComplete: 0,
    });
  });

  it("reports 100% when every actionable item is done", () => {
    const p = summarizePlanProgress([{ status: "done" }, { status: "done" }]);
    expect(p.percentComplete).toBe(100);
    expect(p.active).toBe(0);
  });

  it("excludes skipped items from the completion denominator", () => {
    // 1 done, 1 skipped, 0 remaining -> done/(2-1) = 100%
    const p = summarizePlanProgress([{ status: "done" }, { status: "skipped" }]);
    expect(p.percentComplete).toBe(100);
    expect(p.skipped).toBe(1);
  });

  it("computes a partial percentage", () => {
    // 1 done of 4 actionable (no skips) -> 25%
    const p = summarizePlanProgress([
      { status: "done" },
      { status: "pending" },
      { status: "in_progress" },
      { status: "pending" },
    ]);
    expect(p.percentComplete).toBe(25);
    expect(p.active).toBe(3);
  });

  it("is 0% when all items are skipped (nothing actionable)", () => {
    const p = summarizePlanProgress([{ status: "skipped" }, { status: "skipped" }]);
    expect(p.percentComplete).toBe(0);
  });
});
