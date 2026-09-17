import { describe, expect, it, vi } from "vitest";
import { resolveFeatureConfig } from "../ai-config-resolver";
import { encryptAiApiKey } from "../ai-crypto";

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
});
