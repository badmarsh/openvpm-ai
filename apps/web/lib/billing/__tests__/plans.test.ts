import { describe, it, expect } from "vitest";
import {
  PLANS,
  getPlan,
  planHasFeature,
  isEntitled,
  withinSeatLimit,
  withinLocationLimit,
  isTrialActive,
  effectiveTier,
  ALL_FEATURES,
} from "../plans";

describe("getPlan", () => {
  it("returns the matching plan and falls back to free", () => {
    expect(getPlan("cloud").tier).toBe("cloud");
    expect(getPlan(null).tier).toBe("free");
    expect(getPlan("nonsense").tier).toBe("free");
  });
  it("maps legacy starter/pro tiers onto cloud", () => {
    expect(getPlan("starter").tier).toBe("cloud");
    expect(getPlan("pro").tier).toBe("cloud");
  });
});

describe("planHasFeature (parity)", () => {
  it("cloud and enterprise include every feature; free (lapsed/unpaid) includes none", () => {
    for (const f of ALL_FEATURES) {
      expect(planHasFeature("cloud", f)).toBe(true);
      expect(planHasFeature("enterprise", f)).toBe(true);
      expect(planHasFeature("pro", f)).toBe(true); // legacy → cloud
      expect(planHasFeature("free", f)).toBe(false);
    }
  });
});

describe("isEntitled", () => {
  it("self-host (not enforced) unlocks everything regardless of tier", () => {
    expect(isEntitled("free", "agent", false)).toBe(true);
    expect(isEntitled(null, "sms", false)).toBe(true);
  });
  it("hosted (enforced) gates free/lapsed but allows cloud + enterprise", () => {
    expect(isEntitled("free", "agent", true)).toBe(false);
    expect(isEntitled("cloud", "agent", true)).toBe(true);
    expect(isEntitled("enterprise", "apiAccess", true)).toBe(true);
  });
});

describe("seat + location limits", () => {
  it("not enforced always passes", () => {
    expect(withinSeatLimit("free", 999, false)).toBe(true);
    expect(withinLocationLimit("cloud", 999, false)).toBe(true);
  });
  it("cloud has unlimited seats + locations (billed by quantity)", () => {
    expect(withinSeatLimit("cloud", 100000, true)).toBe(true);
    expect(withinLocationLimit("cloud", 50, true)).toBe(true);
  });
});

describe("trials", () => {
  const now = new Date("2026-06-07T00:00:00Z");
  const future = new Date("2026-06-20T00:00:00Z");
  const past = new Date("2026-06-01T00:00:00Z");

  it("isTrialActive only when status=trialing and not expired", () => {
    expect(isTrialActive("trialing", future, now)).toBe(true);
    expect(isTrialActive("trialing", past, now)).toBe(false);
    expect(isTrialActive("active", future, now)).toBe(false);
    expect(isTrialActive("trialing", null, now)).toBe(false);
  });

  it("effectiveTier grants cloud during an active trial, then reverts to stored tier", () => {
    expect(effectiveTier("free", "trialing", future, now)).toBe("cloud");
    expect(effectiveTier("free", "trialing", past, now)).toBe("free");
    expect(effectiveTier("cloud", "active", future, now)).toBe("cloud");
    expect(effectiveTier("pro", "active", future, now)).toBe("cloud"); // legacy → cloud
  });

  it("an active trial unlocks gated features even on the free tier", () => {
    const tier = effectiveTier("free", "trialing", future, now);
    expect(isEntitled(tier, "agent", true)).toBe(true);
  });
});

describe("PLANS pricing", () => {
  it("is one simple Cloud tier at $99/location, free self-host, enterprise custom", () => {
    expect(PLANS.free.priceMonthlyUsd).toBe(0);
    expect(PLANS.cloud.priceMonthlyUsd).toBe(99);
    expect(PLANS.cloud.pricePerLocation).toBe(true);
    expect(PLANS.enterprise.priceMonthlyUsd).toBeNull();
  });
});
