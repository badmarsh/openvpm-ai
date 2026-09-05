import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  configuredModel: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));

import { formatTranscriptToSoap } from "../soap-formatter";

describe("formatTranscriptToSoap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configuredModel.mockReturnValue("gemini-mock");
  });

  it("parses valid JSON response into 4 SOAP sections", async () => {
    mocks.generateText.mockResolvedValueOnce({
      text: JSON.stringify({
        subjective: "Majiteľ uvádza vracanie 2 dni",
        objective: "TT 38.6, brucho mierne citlivé",
        assessment: "Akútna gastritída",
        plan: "Cerenia 1 mg/kg s.c., diéta",
      }),
    });

    const result = await formatTranscriptToSoap("Pes vracal dva dni, teplota 38.6");

    expect(result).toEqual({
      subjective: "Majiteľ uvádza vracanie 2 dni",
      objective: "TT 38.6, brucho mierne citlivé",
      assessment: "Akútna gastritída",
      plan: "Cerenia 1 mg/kg s.c., diéta",
    });
  });

  it("strips markdown code fences from AI response", async () => {
    mocks.generateText.mockResolvedValueOnce({
      text: "```json\n" + JSON.stringify({
        subjective: "Anamnéza v poriadku",
        objective: "Klinicky zdravý",
        assessment: "Preventívna prehliadka",
        plan: "Vakcinácia o rok",
      }) + "\n```",
    });

    const result = await formatTranscriptToSoap("Klinická preventívna kontrola");

    expect(result.subjective).toBe("Anamnéza v poriadku");
    expect(result.objective).toBe("Klinicky zdravý");
    expect(result.assessment).toBe("Preventívna prehliadka");
    expect(result.plan).toBe("Vakcinácia o rok");
  });

  it("passes patient name and species in prompt context", async () => {
    mocks.generateText.mockResolvedValueOnce({
      text: JSON.stringify({
        subjective: "Pes Max",
        objective: "V poriadku",
        assessment: "Zdravý",
        plan: "Kontrola",
      }),
    });

    await formatTranscriptToSoap("Diktát", {
      patientName: "Max",
      species: "Pes",
      style: "detailed",
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    const callArgs = mocks.generateText.mock.calls[0]?.[0];
    expect(callArgs.prompt).toContain("Pacient: Max (Pes)");
    expect(callArgs.system).toContain("Detailný klinický záznam");
  });

  it("gracefully falls back when AI output is unparseable", async () => {
    mocks.generateText.mockResolvedValueOnce({
      text: "Toto nie je JSON objekt, ale len obyčajný text bez štruktúry",
    });

    const rawTranscript = "Pes mal včera teplotu a nejedol.";
    const result = await formatTranscriptToSoap(rawTranscript);

    expect(result.subjective).toBe(rawTranscript);
    expect(result.objective).toBe("");
    expect(result.assessment).toBe("");
    expect(result.plan).toBe("");
  });
});
