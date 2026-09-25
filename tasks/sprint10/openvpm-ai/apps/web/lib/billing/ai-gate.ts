import { TRPCError } from "@trpc/server";
import type { Database } from "@openpims/db/client";
import { readHostedAiAccess } from "./ai-access";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Shared gate for paid hosted AI features outside the agent runner
 * (marketing image/video/copy generation). It enforces the same two controls
 * as the agent runner: a hosted AI entitlement check and a per-practice
 * sliding-window rate limit. No-op on self-host (readHostedAiAccess returns
 * allowed:true when billing is not enforced).
 */
export const HOSTED_AI_MARKETING_RATE_LIMIT = 20;
export const HOSTED_AI_MARKETING_RATE_WINDOW_MS = 60_000;

/**
 * tRPC v11.13+ maps the PAYMENT_REQUIRED error code to HTTP 402 in the
 * response shape, so the billing denial surfaces as a real 402 to clients
 * (older tRPC versions only had FORBIDDEN/403).
 */
export const PAYMENT_REQUIRED_HTTP_STATUS = 402;

/**
 * Per-practice budget shared by all marketing AI generators. Keyed without
 * the endpoint name so image, video and copy generation together cannot
 * exceed 20 starts per minute for one practice.
 */
export function marketingAiRateLimitKey(practiceId: string): string {
  return `marketing-ai:practice:${practiceId}`;
}

export async function assertHostedAiGate(input: {
  db: Database;
  practiceId: string;
}): Promise<void> {
  const access = await readHostedAiAccess(input.db, input.practiceId);
  if (!access?.allowed) {
    // Native tRPC v11.13+ code — serializes to HTTP 402 Payment Required.
    throw new TRPCError({
      code: "PAYMENT_REQUIRED",
      message: `Payment required: ${
        access?.message ?? "OpenVPM AI is not available for this practice yet."
      }`,
    });
  }

  let result: Awaited<ReturnType<typeof rateLimit>>;
  try {
    result = await rateLimit({
      key: marketingAiRateLimitKey(input.practiceId),
      limit: HOSTED_AI_MARKETING_RATE_LIMIT,
      windowMs: HOSTED_AI_MARKETING_RATE_WINDOW_MS,
    });
  } catch (err) {
    // Fail closed: a broken limiter must never allow AI budget exhaustion.
    console.error("[ai-gate] marketing rate limit check failed:", err);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "AI rate limiting is temporarily unavailable. Please try again in a minute.",
    });
  }

  if (!result.success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded: marketing AI generation is limited to ${HOSTED_AI_MARKETING_RATE_LIMIT} requests per minute per practice. Please slow down and try again shortly.`,
    });
  }
}
