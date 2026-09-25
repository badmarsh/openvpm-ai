import { describe, expect, it, vi } from "vitest";
import { aiSettingsRouter } from "../routers/extensions/ai-settings";
import { encryptAiApiKey } from "@/lib/ai/ai-crypto";

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function createCaller(db: Record<string, unknown>, role = "admin") {
  const session = {
    user: {
      id: USER_ID,
      email: `${role}@example.com`,
      name: "Administrator",
      role,
      practiceId: PRACTICE_ID,
    },
  };
  return aiSettingsRouter.createCaller({ db, session, practiceId: PRACTICE_ID } as never);
}

describe("aiSettingsRouter", () => {
  it("getSettings returns default shape when no config in db", async () => {
    const mockDb: any = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    };

    const caller = createCaller(mockDb);
    const settings = await caller.getSettings();

    expect(settings.openai.hasKey).toBe(false);
    expect(settings.openai.maskedKey).toBe("");
    expect(settings.gemini.hasKey).toBe(false);
    expect(settings.alibaba.hasKey).toBe(false);
    expect(settings.featureMappings).toEqual({});
  });

  it("getSettings masks API keys securely", async () => {
    const rawKey = "sk-aliproxy-test-key-1234";
    const encKey = encryptAiApiKey(rawKey);

    const mockDb: any = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: "ai-1",
                practiceId: PRACTICE_ID,
                openaiApiKeyEncrypted: encKey,
                openaiBaseUrl: "http://127.0.0.1:8080/v1",
                openaiIsActive: true,
                openaiCachedModels: [{ id: "qwen-plus", name: "Qwen Plus" }],
                featureMappings: {
                  assistant: { provider: "openai", model: "qwen-plus" },
                },
              },
            ]),
          })),
        })),
      })),
    };

    const caller = createCaller(mockDb);
    const settings = await caller.getSettings();

    expect(settings.openai.hasKey).toBe(true);
    expect(settings.openai.maskedKey).toBe("••••••••1234");
    expect(settings.openai.maskedKey).not.toContain(rawKey);
    expect(settings.featureMappings.assistant?.model).toBe("qwen-plus");
  });

  it("updateSettings rejects non-admin users with FORBIDDEN", async () => {
    const mockDb: any = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
    };
    const caller = createCaller(mockDb, "veterinarian");

    await expect(
      caller.updateSettings({
        openai: { baseUrl: "http://localhost:8080/v1" },
      }),
    ).rejects.toThrow();
  });

  it("updateSettings encrypts new raw key on update", async () => {
    let updatedSet: any = null;

    const mockDb: any = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: "ai-1",
                practiceId: PRACTICE_ID,
                openaiApiKeyEncrypted: null,
              },
            ]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((data) => {
          updatedSet = data;
          return {
            where: vi.fn(async () => [updatedSet]),
          };
        }),
      })),
    };

    const caller = createCaller(mockDb, "admin");
    const res = await caller.updateSettings({
      openai: {
        baseUrl: "http://127.0.0.1:8080/v1",
        apiKey: "sk-fresh-new-secret-key-5678",
        isActive: true,
      },
      featureMappings: {
        assistant: { provider: "openai", model: "qwen-plus" },
        imagingRtg: { provider: "alibaba", model: "qwen-vl-max" },
      },
    });

    expect(res.success).toBe(true);
    expect(updatedSet).not.toBeNull();
    expect(updatedSet.openaiApiKeyEncrypted).toContain("v1:");
    expect(updatedSet.openaiApiKeyEncrypted).not.toContain("sk-fresh-new-secret-key-5678");
  });

  it("fetchModels enriches and returns model presets for alibaba", async () => {
    let updatedSet: any = null;

    const mockDb: any = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: "ai-1",
                practiceId: PRACTICE_ID,
              },
            ]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((data) => {
          updatedSet = data;
          return {
            where: vi.fn(async () => [updatedSet]),
          };
        }),
      })),
    };

    const caller = createCaller(mockDb, "admin");
    const result = await caller.fetchModels({
      provider: "alibaba",
      baseUrl: "http://127.0.0.1:8080/v1",
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.models.some((m) => m.id === "wan2.1-t2v-turbo")).toBe(true);
    expect(result.models.some((m) => m.id === "qwen-vl-max" && m.isVision)).toBe(true);
  });
});
