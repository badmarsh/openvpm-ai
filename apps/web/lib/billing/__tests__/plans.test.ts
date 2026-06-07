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
    expect(getPlan("pro").tier).toBe("pro");
    expect(getPlan(null).tier).toBe("free");
    expect(getPlan("nonsense").tier).toBe("free");
  });
});

describe("planHasFeature", () => {
  it("pro includes all premium features; starter and free include none", () => {
    for (const f of ALL_FEATURES) {
      expect(planHasFeature("pro", f)).toBe(true);
      expect(planHasFeature("enterprise", f)).toBe(true);
      expect(planHasFeature("starter", f)).toBe(false);
      expect(planHasFeature("free", f)).toBe(false);
    }
  });
});

describe("isEntitled", () => {
  it("self-host (not enforced) unlocks everything regardless of tier", () => {
    expect(isEntitled("free", "agent", false)).toBe(true);
    expect(isEntitled(null, "sms", false)).toBe(true);
  });
  it("hosted (enforced) gates by tier", () => {
    expect(isEntitled("free", "agent", true)).toBe(false);
    expect(isEntitled("starter", "agent", true)).toBe(false);
    expect(isEntitled("pro", "agent", true)).toBe(true);
    expect(isEntitled("enterprise", "apiAccess", true)).toBe(true);
  });
});

describe("seat + location limits", () => {
  it("not enforced always passes", () => {
    expect(withinSeatLimit("free", 999, false)).toBe(true);
    expect(withinLocationLimit("starter", 999, false)).toBe(true);
  });
  it("enforced respects the tier limit (current < limit to add another)", () => {
    expect(withinSeatLimit("starter", 4, true)).toBe(true); // 4 < 5
    expect(withinSeatLimit("starter", 5, true)).toBe(false); // at limit
    expect(withinLocationLimit("starter", 1, true)).toBe(false); // limit 1
    expect(withinLocationLimit("pro", 50, true)).toBe(true); // pro locations unlimited
  });
  it("enterprise/unlimited seats always pass", () => {
    expect(withinSeatLimit("enterprise", 100000, true)).toBe(true);
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

  it("effectiveTier grants pro during an active trial, then reverts", () => {
    expect(effectiveTier("free", "trialing", future, now)).toBe("pro");
    expect(effectiveTier("free", "trialing", past, now)).toBe("free");
    expect(effectiveTier("starter", "active", future, now)).toBe("starter");
  });

  it("an active trial unlocks gated features even on the free tier", () => {
    const tier = effectiveTier("free", "trialing", future, now);
    expect(isEntitled(tier, "agent", true)).toBe(true);
  });
});

describe("PLANS pricing", () => {
  it("matches the agreed value tiers", () => {
    expect(PLANS.free.priceMonthlyUsd).toBe(0);
    expect(PLANS.starter.priceMonthlyUsd).toBe(29);
    expect(PLANS.pro.priceMonthlyUsd).toBe(99);
    expect(PLANS.enterprise.priceMonthlyUsd).toBeNull();
  });
});
