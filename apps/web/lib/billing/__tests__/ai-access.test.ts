import { describe, expect, it } from "vitest";
import {
  AI_TRIAL_BILLING_SETUP_MESSAGE,
  hostedAiAccessDecision,
  type HostedAiPracticeState,
} from "../ai-access";

const now = new Date("2026-08-16T12:00:00.000Z");
const future = new Date("2026-08-30T12:00:00.000Z");
const past = new Date("2026-08-01T12:00:00.000Z");

function trialState(
  overrides: Partial<HostedAiPracticeState> = {},
): HostedAiPracticeState {
  return {
    tier: "cloud",
    billingStatus: "trialing",
    trialEndsAt: future,
    stripeSubscriptionId: null,
    billingSetupRecorded: false,
    ...overrides,
  };
}

describe("hosted AI billing entitlement", () => {
  it("keeps self-host AI outside hosted billing enforcement", () => {
    expect(
      hostedAiAccessDecision(trialState(), { enforced: false, now }),
    ).toEqual({ allowed: true, reason: "allowed", message: null });
  });

  it("blocks a card-free hosted trial without affecting the trial itself", () => {
    expect(
      hostedAiAccessDecision(trialState(), { enforced: true, now }),
    ).toEqual({
      allowed: false,
      reason: "billing_setup_required",
      message: AI_TRIAL_BILLING_SETUP_MESSAGE,
    });
    expect(AI_TRIAL_BILLING_SETUP_MESSAGE).toContain(
      "The rest of your free trial stays available",
    );
    expect(AI_TRIAL_BILLING_SETUP_MESSAGE).toContain(
      "adding a card does not end it",
    );
  });

  it("requires both a current subscription link and signed webhook evidence", () => {
    expect(
      hostedAiAccessDecision(
        trialState({ stripeSubscriptionId: "sub_current" }),
        { enforced: true, now },
      ).allowed,
    ).toBe(false);

    expect(
      hostedAiAccessDecision(trialState({ billingSetupRecorded: true }), {
        enforced: true,
        now,
      }).allowed,
    ).toBe(false);

    expect(
      hostedAiAccessDecision(
        trialState({
          stripeSubscriptionId: "sub_current",
          billingSetupRecorded: true,
        }),
        { enforced: true, now },
      ),
    ).toEqual({ allowed: true, reason: "allowed", message: null });
  });

  it("allows active and retrying paid subscriptions without trial evidence", () => {
    for (const billingStatus of ["active", "past_due"]) {
      expect(
        hostedAiAccessDecision(
          trialState({
            billingStatus,
            trialEndsAt: null,
            stripeSubscriptionId: "sub_current",
          }),
          { enforced: true, now },
        ).allowed,
      ).toBe(true);
    }
  });

  it("keeps inactive subscriptions and expired trials blocked", () => {
    for (const state of [
      trialState({ billingStatus: "unpaid", trialEndsAt: null }),
      trialState({ billingStatus: "canceled", trialEndsAt: null }),
      trialState({ trialEndsAt: past }),
    ]) {
      expect(
        hostedAiAccessDecision(state, { enforced: true, now }),
      ).toMatchObject({
        allowed: false,
        reason: "subscription_inactive",
      });
    }
  });
});
