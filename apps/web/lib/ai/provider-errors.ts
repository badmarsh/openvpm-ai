import { TRPCError } from "@trpc/server";

/**
 * Shared failure classification for AI-provider calls (dictation STT, SOAP
 * formatting, SOAP drafting, …).
 *
 * Why this exists
 * ---------------
 * Those calls go over the network to an LLM provider, so some failures are
 * structural and expected: no provider is configured at all, the provider
 * answered with 4xx (bad key, quota), or the operator's gateway is slower than
 * the hard timeout. They are operational states, not code defects.
 *
 * The pipeline used to wrap every one of them in `INTERNAL_SERVER_ERROR`, and
 * error tracking alerts on exactly that code — so a clinic that had not
 * configured an AI key yet produced an ops alert with a full stack trace for
 * every single dictation attempt.
 *
 * Classification keeps two promises:
 *   1. Expected failures are reported to the user with a stable, translatable
 *      message and never page the on-call rotation.
 *   2. Anything genuinely unexpected still reports through the normal channel.
 */

const PROVIDER_CONFIGURATION_PATTERNS: RegExp[] = [
  /OpenVPM Agent is not configured/i,
  /not configured/i,
  /api[\s_-]?key/i,
  /missing (?:the )?(?:api )?key/i,
  /invalid (?:api )?key/i,
  /unauthorized/i,
  /permission denied/i,
  /quota/i,
  /billing/i,
  /no (?:active )?(?:ai )?provider/i,
  /no ai provider/i,
];

const TIMEOUT_PATTERNS: RegExp[] = [
  /timed out/i,
  /timeout/i,
  /\baborted\b/i,
  /abortsignal/i,
  /deadline exceeded/i,
  /operation was aborted/i,
];

/** Machine-readable reason, also stored with degraded AI results. */
export type AiFailureReason =
  | "not_configured"
  | "timeout"
  | "provider_error";

/**
 * Extract the human-readable message from whatever the AI SDK threw. The
 * provider SDKs wrap failures in `APICallError`/`RetryError` with a `cause`
 * chain, and the aggregated retry message ("Failed after 3 attempts. Last
 * error: …") usually carries the real cause.
 */
export function providerErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    if (
      cause instanceof Error &&
      cause.message &&
      cause.message !== error.message
    ) {
      return `${error.message} (${cause.message})`;
    }
    if (error.message) return error.message;
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  return "";
}

export function isProviderConfigurationError(error: unknown): boolean {
  const message = providerErrorMessage(error);
  if (!message) return false;
  return PROVIDER_CONFIGURATION_PATTERNS.some((pattern) =>
    pattern.test(message),
  );
}

export function isProviderTimeoutError(error: unknown): boolean {
  const message = providerErrorMessage(error);
  if (!message) return false;
  return TIMEOUT_PATTERNS.some((pattern) => pattern.test(message));
}

/** Classify a provider failure; `null` means it is unexpected. */
export function aiFailureReason(error: unknown): AiFailureReason | null {
  if (isProviderConfigurationError(error)) return "not_configured";
  if (isProviderTimeoutError(error)) return "timeout";
  return null;
}

/**
 * Wrap a provider failure into a TRPCError.
 *
 * `PRECONDITION_FAILED` and `TIMEOUT` are not captured by error tracking, so
 * expected operational failures stay out of ops alerts while the original error
 * is preserved as `cause` for structured logs.
 */
export function aiProviderTrpcError(
  error: unknown,
  fallbackMessage: string,
): TRPCError {
  if (isProviderConfigurationError(error)) {
    return new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        providerErrorMessage(error) ||
        "AI provider is not configured. Add your provider credentials in Settings → AI.",
      cause: error,
    });
  }
  if (isProviderTimeoutError(error)) {
    return new TRPCError({
      code: "TIMEOUT",
      message:
        "The AI provider did not answer within the time limit. Try again, or set a faster model in Settings → AI.",
      cause: error,
    });
  }
  const detail = providerErrorMessage(error);
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: detail ? `${fallbackMessage}: ${detail}` : fallbackMessage,
    cause: error,
  });
}
