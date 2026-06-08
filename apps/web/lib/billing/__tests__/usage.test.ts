import { describe, it, expect } from "vitest";
import { currentPeriodMonth } from "../usage";

describe("currentPeriodMonth", () => {
  it("formats the billing period as YYYY-MM (UTC)", () => {
    expect(currentPeriodMonth(new Date("2026-06-07T12:00:00Z"))).toBe("2026-06");
    expect(currentPeriodMonth(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
    expect(currentPeriodMonth(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
});
