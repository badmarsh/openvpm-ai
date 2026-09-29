import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const mocks = vi.hoisted(() => ({
  readHostedAiAccess: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/billing/ai-access", () => ({
  readHostedAiAccess: mocks.readHostedAiAccess,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

import {
  assertHostedAiGate,
  HOSTED_AI_MARKETING_RATE_LIMIT,
  HOSTED_AI_MARKETING_RATE_WINDOW_MS,
  marketingAiRateLimitKey,
  PAYMENT_REQUIRED_HTTP_STATUS,
} from "../ai-gate";

const PRACTICE_ID = "00000000-0000-0000-0000-000000000abc";
const db = Symbol("db");

describe("assertHostedAiGate (marketing AI billing gate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readHostedAiAccess.mockResolvedValue({
      allowed: true,
      reason: "allowed",
      message: null,
    });
    mocks.rateLimit.mockResolvedValue({
      success: true,
      remaining: 19,
      resetAt: new Date("2026-09-12T12:01:00Z"),
    });
  });

  it("allows a practice with active entitlement and rate-limit capacity", async () => {
    await expect(
      assertHostedAiGate({ db: db as never, practiceId: PRACTICE_ID }),
    ).resolves.toBeUndefined();

    expect(mocks.readHostedAiAccess).toHaveBeenCalledWith(db, PRACTICE_ID);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.rateLimit).toHaveBeenCalledWith({
      key: marketingAiRateLimitKey(PRACTICE_ID),
      limit: 20,
      windowMs: 60_000,
    });
  });

  it("enforces 20 starts per 60s window, shared across all marketing generators", () => {
    expect(HOSTED_AI_MARKETING_RATE_LIMIT).toBe(20);
    expect(HOSTED_AI_MARKETING_RATE_WINDOW_MS).toBe(60_000);
    // Keyed by practice only so image + video + copy share one budget.
    expect(marketingAiRateLimitKey(PRACTICE_ID)).toBe(
      `marketing-ai:practice:${PRACTICE_ID}`,
    );
    expect(marketingAiRateLimitKey(PRACTICE_ID)).not.toContain("generateImage");
  });

  it("throws PAYMENT_REQUIRED (HTTP 402) with a clear message when billing denies", async () => {
    mocks.readHostedAiAccess.mockResolvedValue({
      allowed: false,
      reason: "subscription_inactive",
      message: "OpenVPM AI is available when your trial or subscription is active.",
    });

    const err = await assertHostedAiGate({
      db: db as never,
      practiceId: PRACTICE_ID,
    }).then(
      () => {
        throw new Error("expected rejection");
      },
      (e) => e,
    );

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("PAYMENT_REQUIRED");
    expect((err as TRPCError).message).toBe(
      "Payment required: OpenVPM AI is available when your trial or subscription is active.",
    );
    // tRPC v11.13 serializes PAYMENT_REQUIRED to the real HTTP 402 status.
    expect(PAYMENT_REQUIRED_HTTP_STATUS).toBe(402);
    // Billing is checked first; a denied practice never touches the limiter.
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("falls back to an actionable message when the decision carries none", async () => {
    mocks.readHostedAiAccess.mockResolvedValue({
      allowed: false,
      reason: "subscription_inactive",
      message: null,
    });

    await expect(
      assertHostedAiGate({ db: db as never, practiceId: PRACTICE_ID }),
    ).rejects.toThrow(/not available for this practice yet/);
  });

  it("throws TOO_MANY_REQUESTS once the practice window is exhausted", async () => {
    mocks.rateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: new Date("2026-09-12T12:01:00Z"),
    });

    const err = await assertHostedAiGate({
      db: db as never,
      practiceId: PRACTICE_ID,
    }).then(
      () => {
        throw new Error("expected rejection");
      },
      (e) => e,
    );

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    expect((err as TRPCError).message).toContain("20 requests per minute");
  });

  it("fails closed when the rate limiter itself errors", async () => {
    mocks.rateLimit.mockRejectedValue(new Error("rate limit table missing"));

    const err = await assertHostedAiGate({
      db: db as never,
      practiceId: PRACTICE_ID,
    }).then(
      () => {
        throw new Error("expected rejection");
      },
      (e) => e,
    );

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    expect((err as TRPCError).message).toMatch(/temporarily unavailable/);
  });
});
