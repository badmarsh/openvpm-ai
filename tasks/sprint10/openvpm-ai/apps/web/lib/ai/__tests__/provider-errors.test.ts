import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  aiFailureReason,
  aiProviderTrpcError,
  isProviderConfigurationError,
  isProviderTimeoutError,
  providerErrorMessage,
} from "@/lib/ai/provider-errors";

class RetryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AI_RetryError";
  }
}

/**
 * Error tracking alerts on `INTERNAL_SERVER_ERROR` only. A missing AI provider
 * or a slow gateway must therefore be classified out of that bucket, otherwise
 * a clinic that simply has not configured a key yet pages the on-call rotation
 * for every dictation attempt.
 */
describe("AI provider error classification", () => {
  it("recognises the not-configured provider error", () => {
    const error = new Error(
      "OpenVPM Agent is not configured. Configure Google Vertex AI for Gemini, or set ANTHROPIC_API_KEY for an explicit Claude model.",
    );

    expect(isProviderConfigurationError(error)).toBe(true);
    expect(isProviderTimeoutError(error)).toBe(false);
    expect(aiFailureReason(error)).toBe("not_configured");
  });

  it("recognises an upstream credential rejection", () => {
    const error = new Error(
      "Model gemini-3.8-flash transcription failed (401): invalid api key",
    );

    expect(isProviderConfigurationError(error)).toBe(true);
  });

  it("recognises a provider timeout, including the AI SDK retry wrapper", () => {
    const error = new RetryError(
      "Failed after 3 attempts. Last error: SOAP formatting timed out after 30s",
    );

    expect(isProviderTimeoutError(error)).toBe(true);
    expect(aiFailureReason(error)).toBe("timeout");
  });

  it("reads the cause chain so the retry message keeps the real reason", () => {
    const error = new RetryError("Failed after 3 attempts.", {
      cause: new Error("SOAP formatting timed out after 30s"),
    });

    expect(providerErrorMessage(error)).toContain("timed out");
  });

  it("leaves unexpected failures unclassified", () => {
    const error = new TypeError("Cannot read properties of undefined");

    expect(aiFailureReason(error)).toBeNull();
    const trpcError = aiProviderTrpcError(error, "SOAP formatting failed");
    expect(trpcError).toBeInstanceOf(TRPCError);
    expect(trpcError.code).toBe("INTERNAL_SERVER_ERROR");
    expect(trpcError.cause).toBe(error);
  });

  it("maps expected failures onto non-alerting tRPC codes", () => {
    const notConfigured = aiProviderTrpcError(
      new Error("OpenVPM Agent is not configured."),
      "Audio transcription failed",
    );
    expect(notConfigured.code).toBe("PRECONDITION_FAILED");

    const timeout = aiProviderTrpcError(
      new Error("Audio transcription timed out after 60s"),
      "Audio transcription failed",
    );
    expect(timeout.code).toBe("TIMEOUT");
  });
});
