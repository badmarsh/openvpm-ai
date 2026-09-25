import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  configuredModel: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
  isAgentConfigured: () => true,
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));

import { formatTranscriptToSoap } from "../soap-formatter";

/**
 * The dictation pipeline used to turn an unreachable AI provider into a hard
 * failure: the vet lost the record and the platform raised an ops alert. These
 * tests pin the new contract — the transcript survives and the failure is
 * reported as degraded, not thrown.
 */
describe("formatTranscriptToSoap provider failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configuredModel.mockReturnValue("gemini-mock");
  });

  it("keeps the transcript when the provider reports a configuration error", async () => {
    mocks.generateText.mockRejectedValueOnce(
      new Error(
        "OpenVPM Agent is not configured. Configure Google Vertex AI for Gemini, or set ANTHROPIC_API_KEY for an explicit Claude model.",
      ),
    );

    const transcript = "Pes Max, vracanie dva dni, teplota 38.6.";
    const result = await formatTranscriptToSoap(transcript);

    expect(result.subjective).toBe(transcript);
    expect(result.degraded?.reason).toBe("not_configured");
    // The same failure repeats on a retry, so no request is wasted on one.
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it("retries once after a timeout and then degrades with the transcript intact", async () => {
    const timeoutError = new Error("SOAP formatting timed out after 45s");
    mocks.generateText
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    const transcript = "Mačka, apatia, TT 39.1";
    const result = await formatTranscriptToSoap(transcript);

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result.subjective).toBe(transcript);
    expect(result.degraded?.reason).toBe("timeout");
    expect(result.degraded?.detail).toContain("timed out");
  });

  it("returns the formatted note when the retry succeeds", async () => {
    mocks.generateText
      .mockRejectedValueOnce(new Error("SOAP formatting timed out after 45s"))
      .mockResolvedValueOnce({
        text: JSON.stringify({
          subjective: "Vracanie 2 dni",
          objective: "TT 38.6",
          assessment: "Gastritída",
          plan: "Cerenia 1 mg/kg s.c.",
        }),
      });

    const result = await formatTranscriptToSoap("Pes vracal dva dni");

    expect(result.degraded).toBeUndefined();
    expect(result.assessment).toBe("Gastritída");
  });
});

describe("formatTranscriptToSoap without a configured provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips the provider call and degrades instead of throwing", async () => {
    vi.doMock("@/lib/agent/runner", () => ({
      configuredModel: mocks.configuredModel,
      isAgentConfigured: () => false,
    }));
    vi.resetModules();
    const fresh = await import("../soap-formatter");

    const transcript = "Kontrola po operácii, stehy čisté.";
    const result = await fresh.formatTranscriptToSoap(transcript);

    expect(result.subjective).toBe(transcript);
    expect(result.degraded?.reason).toBe("not_configured");
    expect(mocks.generateText).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/agent/runner");
  });
});
