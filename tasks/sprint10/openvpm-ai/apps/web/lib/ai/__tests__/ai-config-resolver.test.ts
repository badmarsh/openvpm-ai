import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveFeatureConfig } from "../ai-config-resolver";
import { encryptAiApiKey } from "../ai-crypto";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";

describe("ai-config-resolver", () => {
  it("falls back to default when no practice configuration exists", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    };

    const resolved = await resolveFeatureConfig(mockDb, PRACTICE_ID, "assistant");
    expect(resolved.provider).toBe("default");
    expect(resolved.modelId).toBeDefined();
  });

  it("resolves custom openai configuration and decrypts key", async () => {
    const rawKey = "sk-custom-openai-secret";
    const encKey = encryptAiApiKey(rawKey);

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: "ai-1",
                practiceId: PRACTICE_ID,
                openaiApiKeyEncrypted: encKey,
                openaiBaseUrl: "http://localhost:8080/v1",
                openaiIsActive: true,
                featureMappings: {
                  assistant: { provider: "openai", model: "qwen-max", temperature: 0.3 },
                },
              },
            ]),
          })),
        })),
      })),
    };

    const resolved = await resolveFeatureConfig(mockDb, PRACTICE_ID, "assistant");
    expect(resolved.provider).toBe("openai");
    expect(resolved.modelId).toBe("qwen-max");
    expect(resolved.baseUrl).toBe("http://localhost:8080/v1");
    expect(resolved.apiKey).toBe(rawKey);
    expect(resolved.temperature).toBe(0.3);
  });

  it("resolves alibaba video generation with duration and size defaults", async () => {
    const rawKey = "sk-aliproxy-video-key";
    const encKey = encryptAiApiKey(rawKey);

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: "ai-1",
                practiceId: PRACTICE_ID,
                alibabaApiKeyEncrypted: encKey,
                alibabaBaseUrl: "http://127.0.0.1:8080/v1",
                alibabaIsActive: true,
                featureMappings: {
                  videoGeneration: { provider: "alibaba", model: "wan-t2v", duration: 5 },
                },
              },
            ]),
          })),
        })),
      })),
    };

    const resolved = await resolveFeatureConfig(mockDb, PRACTICE_ID, "videoGeneration");
    expect(resolved.provider).toBe("alibaba");
    expect(resolved.modelId).toBe("wan-t2v");
    expect(resolved.apiKey).toBe(rawKey);
    expect(resolved.duration).toBe(5);
  });

  function mockConfigRow(row: Record<string, unknown>) {
    return {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [row]),
          })),
        })),
      })),
    };
  }

  it("falls back to an active provider when the designated key fails to decrypt, without leaking the designated model id", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Designated provider is Gemini with a corrupt encrypted key (4-part
      // v1 envelope that fails GCM auth); OpenAI is active with a healthy
      // key. The fallback must not carry the Gemini model id over to the
      // OpenAI endpoint (that would 404 there).
      const db = mockConfigRow({
        id: "ai-1",
        practiceId: PRACTICE_ID,
        geminiIsActive: true,
        geminiApiKeyEncrypted: "v1:AAAAAAAAAAAA:BBBBBBBBBBBB:CCCCCCCCCCCC",
        openaiIsActive: true,
        openaiApiKeyEncrypted: encryptAiApiKey("sk-openai-fallback"),
        featureMappings: {
          assistant: { provider: "gemini", model: "gemini-3.6-flash" },
        },
      });

      const resolved = await resolveFeatureConfig(db, PRACTICE_ID, "assistant");

      expect(resolved.provider).toBe("openai");
      expect(resolved.modelId).toBe(DEFAULT_AI_MODEL);
      expect(resolved.modelId).not.toBe("gemini-3.6-flash");
      expect(resolved.apiKey).toBe("sk-openai-fallback");
      // The decrypt failure is observable, not silent.
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps the designated model id when the designated provider itself is the openai fallback target", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Designated provider IS OpenAI; its key decrypts fine on the primary
      // path, so no fallback is involved — the mapping model is preserved.
      const db = mockConfigRow({
        id: "ai-1",
        practiceId: PRACTICE_ID,
        openaiIsActive: true,
        openaiApiKeyEncrypted: encryptAiApiKey("sk-openai-primary"),
        featureMappings: {
          assistant: { provider: "openai", model: "gpt-4o-mini" },
        },
      });

      const resolved = await resolveFeatureConfig(db, PRACTICE_ID, "assistant");
      expect(resolved.provider).toBe("openai");
      expect(resolved.modelId).toBe("gpt-4o-mini");
    } finally {
      warn.mockRestore();
    }
  });

  it("falls back to system default when no provider is active or decryptable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const db = mockConfigRow({
        id: "ai-1",
        practiceId: PRACTICE_ID,
        geminiIsActive: false,
        openaiIsActive: false,
        alibabaIsActive: false,
        featureMappings: {
          assistant: { provider: "gemini", model: "gemini-3.6-flash" },
        },
      });

      const resolved = await resolveFeatureConfig(db, PRACTICE_ID, "assistant");
      expect(resolved.provider).toBe("default");
      expect(resolved.apiKey).toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });
});
