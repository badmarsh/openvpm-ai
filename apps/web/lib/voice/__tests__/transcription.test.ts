import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readPrimaryObject: vi.fn(),
  generateText: vi.fn(),
  configuredModel: vi.fn(),
  hasInferenceProxyConfiguration: vi.fn(() => false),
  inferenceProxyBaseUrl: vi.fn(() => "http://127.0.0.1:8045/v1"),
}));

vi.mock("@/lib/s3", () => ({
  readPrimaryObject: mocks.readPrimaryObject,
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));

vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
}));

vi.mock("@/lib/agent/inference-proxy", () => ({
  hasInferenceProxyConfiguration: mocks.hasInferenceProxyConfiguration,
  inferenceProxyBaseUrl: mocks.inferenceProxyBaseUrl,
}));

import { transcribeAudio } from "../transcription";

describe("transcribeAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configuredModel.mockReturnValue("gemini-model");
    mocks.hasInferenceProxyConfiguration.mockReturnValue(false);
  });

  it("calls generateText with audio file part when no inference proxy is configured", async () => {
    const audioBuffer = Buffer.from("fake-audio-payload");
    mocks.readPrimaryObject.mockResolvedValueOnce({
      status: "available",
      body: audioBuffer,
      contentType: "audio/webm",
    });

    mocks.generateText.mockResolvedValueOnce({
      text: "Pacient Bono bol vyšetrený.",
    });

    const result = await transcribeAudio("voice/practice/test.webm");

    expect(result).toBe("Pacient Bono bol vyšetrený.");
    expect(mocks.generateText).toHaveBeenCalledTimes(1);

    const callArgs = mocks.generateText.mock.calls[0][0];
    const filePart = callArgs.messages[0].content.find(
      (p: any) => p.type === "file",
    );
    expect(filePart).toBeDefined();
    expect(filePart.mediaType).toBe("audio/webm");
  });

  it("transcribes via inference proxy when AI_BASE_URL is active", async () => {
    mocks.hasInferenceProxyConfiguration.mockReturnValue(true);
    const audioBuffer = Buffer.from("fake-audio-payload");
    mocks.readPrimaryObject.mockResolvedValueOnce({
      status: "available",
      body: audioBuffer,
      contentType: "audio/webm",
    });

    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: "Kontrola pacienta Bono." } },
        ],
      }),
    });
    global.fetch = fetchMock as any;

    try {
      const result = await transcribeAudio("voice/practice/test.webm");
      expect(result).toBe("Kontrola pacienta Bono.");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe("http://127.0.0.1:8045/v1/chat/completions");
      const body = JSON.parse(opts.body);
      const imgPart = body.messages[1].content.find(
        (p: any) => p.type === "image_url",
      );
      expect(imgPart).toBeDefined();
      expect(imgPart.image_url.url).toContain("data:audio/webm;base64,");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("throws descriptive error when object is missing in S3", async () => {
    mocks.readPrimaryObject.mockResolvedValueOnce({
      status: "missing",
    });

    await expect(transcribeAudio("voice/practice/missing.webm")).rejects.toThrow(
      "Audio sa v úložisku nenašlo",
    );
  });
});
