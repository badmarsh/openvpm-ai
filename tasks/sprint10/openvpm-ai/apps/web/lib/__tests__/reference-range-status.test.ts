import { describe, expect, it } from "vitest";
import { deriveRangeStatus } from "@/lib/lab/reference-range-status";

const base = { resultValue: null, referenceRangeLow: null, referenceRangeHigh: null };

describe("deriveRangeStatus", () => {
  it("keeps the recorded critical flag authoritative", () => {
    expect(deriveRangeStatus({ ...base, resultFlag: "critical", resultValue: "5", referenceRangeLow: "1", referenceRangeHigh: "10" })).toBe("critical");
  });
  it("refines out-of-range values to low / high", () => {
    expect(deriveRangeStatus({ ...base, resultFlag: "abnormal", resultValue: "0,5", referenceRangeLow: "1", referenceRangeHigh: "10" })).toBe("low");
    expect(deriveRangeStatus({ ...base, resultFlag: "unknown", resultValue: "12", referenceRangeLow: "1", referenceRangeHigh: "10" })).toBe("high");
  });
  it("handles normal, abnormal and pending", () => {
    expect(deriveRangeStatus({ ...base, resultFlag: "normal", resultValue: "5" })).toBe("normal");
    expect(deriveRangeStatus({ ...base, resultFlag: "abnormal", resultValue: "pos" })).toBe("abnormal");
    expect(deriveRangeStatus({ ...base, resultFlag: "unknown" })).toBe("pending");
  });
});
