import { describe, it, expect } from "vitest";
import {
  currentPeriodMonth,
  crossesAbuseThreshold,
  ABUSE_ALERT_THRESHOLDS,
} from "../usage";

describe("currentPeriodMonth", () => {
  it("formats the billing period as YYYY-MM (UTC)", () => {
    expect(currentPeriodMonth(new Date("2026-06-07T12:00:00Z"))).toBe("2026-06");
    expect(currentPeriodMonth(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
    expect(currentPeriodMonth(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
});

describe("crossesAbuseThreshold", () => {
  const sms = ABUSE_ALERT_THRESHOLDS.sms;
  const ai = ABUSE_ALERT_THRESHOLDS.ai_run;

  it("fires exactly once on the insert that crosses the boundary", () => {
    expect(crossesAbuseThreshold("sms", sms - 1, sms)).toBe(true);
    expect(crossesAbuseThreshold("sms", sms - 5, sms + 3)).toBe(true);
    expect(crossesAbuseThreshold("ai_run", ai - 1, ai)).toBe(true);
  });

  it("does not fire below the threshold", () => {
    expect(crossesAbuseThreshold("sms", 0, 1)).toBe(false);
    expect(crossesAbuseThreshold("sms", sms - 10, sms - 1)).toBe(false);
  });

  it("does not re-fire once already past the threshold", () => {
    expect(crossesAbuseThreshold("sms", sms, sms + 1)).toBe(false);
    expect(crossesAbuseThreshold("ai_run", ai + 5, ai + 6)).toBe(false);
  });
});
