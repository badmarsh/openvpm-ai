import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  createRouter,
  protectedProcedure,
  requireRole,
} from "../../trpc";
import { extAiSettings, type CachedAiModel, type PracticeAiFeatureMappings } from "@openpims/db";
import { encryptAiApiKey, decryptAiApiKey, maskApiKey } from "@/lib/ai/ai-crypto";
import { checkAlibabaProxyHealth } from "@/lib/ai/alibaba-proxy";
import {
  DEFAULT_ALIBABA_PRESETS,
  DEFAULT_GEMINI_PRESETS,
  DEFAULT_PRACTICE_FEATURE_MAPPINGS,
} from "@/lib/ai/ai-presets";

export const aiSettingsRouter = createRouter({
  /**
   * Get settings for practice. API keys are masked.
   */
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const [config] = await ctx.db
      .select()
      .from(extAiSettings)
      .where(
        and(
          eq(extAiSettings.practiceId, ctx.practiceId),
          eq(extAiSettings.isActive, true),
          isNull(extAiSettings.deletedAt),
        ),
      )
      .limit(1);

    if (!config) {
      return {
        openai: {
          baseUrl: "http://127.0.0.1:8080/v1",
          hasKey: false,
          maskedKey: "",
          isActive: false,
          cachedModels: [] as CachedAiModel[],
          lastTestedAt: null,
          lastStatus: null,
          lastStatusMessage: null,
        },
        gemini: {
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
          hasKey: false,
          maskedKey: "",
          isActive: false,
          cachedModels: DEFAULT_GEMINI_PRESETS,
          lastTestedAt: null,
          lastStatus: null,
          lastStatusMessage: null,
        },
        alibaba: {
          mode: "aliproxy_local",
          baseUrl: "http://127.0.0.1:8080/v1",
          hasKey: false,
          maskedKey: "",
          isActive: false,
          cachedModels: DEFAULT_ALIBABA_PRESETS,
          lastTestedAt: null,
          lastStatus: null,
          lastStatusMessage: null,
        },
        featureMappings: {} as PracticeAiFeatureMappings,
      };
    }

    const safeDecrypt = (val: string | null | undefined): string => {
      try {
        return decryptAiApiKey(val);
      } catch (err) {
        console.warn("[ai-settings] Failed to decrypt stored API key, treating as unconfigured:", err instanceof Error ? err.message : err);
        return "";
      }
    };

    const decryptedOpenai = safeDecrypt(config.openaiApiKeyEncrypted);
    const decryptedGemini = safeDecrypt(config.geminiApiKeyEncrypted);
    const decryptedAlibaba = safeDecrypt(config.alibabaApiKeyEncrypted);

    return {
      openai: {
        baseUrl: config.openaiBaseUrl || "http://127.0.0.1:8080/v1",
        hasKey: Boolean(decryptedOpenai),
        maskedKey: maskApiKey(decryptedOpenai),
        isActive: config.openaiIsActive,
        cachedModels: (config.openaiCachedModels || []) as CachedAiModel[],
        lastTestedAt: config.openaiLastTestedAt,
        lastStatus: config.openaiLastStatus,
        lastStatusMessage: config.openaiLastStatusMessage,
      },
      gemini: {
        baseUrl: config.geminiBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/",
        hasKey: Boolean(decryptedGemini),
        maskedKey: maskApiKey(decryptedGemini),
        isActive: config.geminiIsActive,
        cachedModels: (
          (config.geminiCachedModels as CachedAiModel[])?.length
            ? (config.geminiCachedModels as CachedAiModel[])
            : DEFAULT_GEMINI_PRESETS
        ),
        lastTestedAt: config.geminiLastTestedAt,
        lastStatus: config.geminiLastStatus,
        lastStatusMessage: config.geminiLastStatusMessage,
      },
      alibaba: {
        mode: config.alibabaMode || "aliproxy_local",
        baseUrl: config.alibabaBaseUrl || "http://127.0.0.1:8080/v1",
        hasKey: Boolean(decryptedAlibaba),
        maskedKey: maskApiKey(decryptedAlibaba),
        isActive: config.alibabaIsActive,
        cachedModels: (
          (config.alibabaCachedModels as CachedAiModel[])?.length
            ? (config.alibabaCachedModels as CachedAiModel[])
            : DEFAULT_ALIBABA_PRESETS
        ),
        lastTestedAt: config.alibabaLastTestedAt,
        lastStatus: config.alibabaLastStatus,
        lastStatusMessage: config.alibabaLastStatusMessage,
      },
      featureMappings: (config.featureMappings || {}) as PracticeAiFeatureMappings,
    };
  }),

  /**
   * Save / update settings for practice. Only admin role allowed.
   */
  updateSettings: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        openai: z.object({
          baseUrl: z.string().optional(),
          apiKey: z.string().optional(),
          isActive: z.boolean().optional(),
        }).optional(),
        gemini: z.object({
          baseUrl: z.string().optional(),
          apiKey: z.string().optional(),
          isActive: z.boolean().optional(),
        }).optional(),
        alibaba: z.object({
          mode: z.string().optional(),
          baseUrl: z.string().optional(),
          apiKey: z.string().optional(),
          isActive: z.boolean().optional(),
        }).optional(),
        featureMappings: z.record(
          z.object({
            provider: z.enum(["openai", "gemini", "alibaba", "default"]),
            model: z.string(),
            temperature: z.number().min(0).max(2).optional(),
            maxTokens: z.number().min(1).max(32768).optional(),
            size: z.string().optional(),
            duration: z.number().optional(),
          }),
        ).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(extAiSettings)
        .where(
          and(
            eq(extAiSettings.practiceId, ctx.practiceId),
            eq(extAiSettings.isActive, true),
            isNull(extAiSettings.deletedAt),
          ),
        )
        .limit(1);

      // Resolve OpenAI API key encryption
      let openaiKeyEnc = existing?.openaiApiKeyEncrypted ?? null;
      if (input.openai?.apiKey !== undefined) {
        const raw = input.openai.apiKey.trim();
        if (raw && !raw.startsWith("••••")) {
          openaiKeyEnc = encryptAiApiKey(raw);
        } else if (!raw) {
          openaiKeyEnc = null;
        }
      }

      // Resolve Gemini API key encryption
      let geminiKeyEnc = existing?.geminiApiKeyEncrypted ?? null;
      if (input.gemini?.apiKey !== undefined) {
        const raw = input.gemini.apiKey.trim();
        if (raw && !raw.startsWith("••••")) {
          geminiKeyEnc = encryptAiApiKey(raw);
        } else if (!raw) {
          geminiKeyEnc = null;
        }
      }

      // Resolve Alibaba API key encryption
      let alibabaKeyEnc = existing?.alibabaApiKeyEncrypted ?? null;
      if (input.alibaba?.apiKey !== undefined) {
        const raw = input.alibaba.apiKey.trim();
        if (raw && !raw.startsWith("••••")) {
          alibabaKeyEnc = encryptAiApiKey(raw);
        } else if (!raw) {
          alibabaKeyEnc = null;
        }
      }

      const featureMappings = input.featureMappings ?? existing?.featureMappings ?? {};

      if (existing) {
        await ctx.db
          .update(extAiSettings)
          .set({
            openaiBaseUrl: input.openai?.baseUrl ?? existing.openaiBaseUrl,
            openaiApiKeyEncrypted: openaiKeyEnc,
            openaiIsActive: input.openai?.isActive ?? existing.openaiIsActive,
            geminiBaseUrl: input.gemini?.baseUrl ?? existing.geminiBaseUrl,
            geminiApiKeyEncrypted: geminiKeyEnc,
            geminiIsActive: input.gemini?.isActive ?? existing.geminiIsActive,
            alibabaMode: input.alibaba?.mode ?? existing.alibabaMode,
            alibabaBaseUrl: input.alibaba?.baseUrl ?? existing.alibabaBaseUrl,
            alibabaApiKeyEncrypted: alibabaKeyEnc,
            alibabaIsActive: input.alibaba?.isActive ?? existing.alibabaIsActive,
            featureMappings: featureMappings as any,
            updatedAt: new Date(),
          })
          .where(eq(extAiSettings.id, existing.id));
      } else {
        await ctx.db.insert(extAiSettings).values({
          practiceId: ctx.practiceId,
          openaiBaseUrl: input.openai?.baseUrl || "http://127.0.0.1:8080/v1",
          openaiApiKeyEncrypted: openaiKeyEnc,
          openaiIsActive: input.openai?.isActive ?? false,
          geminiBaseUrl: input.gemini?.baseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/",
          geminiApiKeyEncrypted: geminiKeyEnc,
          geminiIsActive: input.gemini?.isActive ?? false,
          alibabaMode: input.alibaba?.mode || "aliproxy_local",
          alibabaBaseUrl: input.alibaba?.baseUrl || "http://127.0.0.1:8080/v1",
          alibabaApiKeyEncrypted: alibabaKeyEnc,
          alibabaIsActive: input.alibaba?.isActive ?? false,
          featureMappings: featureMappings as any,
          isActive: true,
        });
      }

      return { success: true };
    }),

  /**
   * Test connection to a provider endpoint and measure roundtrip latency.
   */
  testConnection: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        provider: z.enum(["openai", "gemini", "alibaba"]),
        baseUrl: z.string().optional(),
        apiKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(extAiSettings)
        .where(
          and(
            eq(extAiSettings.practiceId, ctx.practiceId),
            eq(extAiSettings.isActive, true),
            isNull(extAiSettings.deletedAt),
          ),
        )
        .limit(1);

      // Resolve key
      let rawKey = input.apiKey?.trim() || "";
      if (rawKey.startsWith("••••") || !rawKey) {
        try {
          if (input.provider === "openai") rawKey = decryptAiApiKey(existing?.openaiApiKeyEncrypted);
          if (input.provider === "gemini") rawKey = decryptAiApiKey(existing?.geminiApiKeyEncrypted);
          if (input.provider === "alibaba") rawKey = decryptAiApiKey(existing?.alibabaApiKeyEncrypted);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Uložený API kľúč sa nepodarilo dešifrovať. Zadajte ho znova.",
          });
        }
      }

      // Resolve base URL
      let baseUrl = input.baseUrl?.trim() || "";
      if (!baseUrl) {
        if (input.provider === "openai") baseUrl = existing?.openaiBaseUrl || "http://127.0.0.1:8080/v1";
        if (input.provider === "gemini") baseUrl = existing?.geminiBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/";
        if (input.provider === "alibaba") baseUrl = existing?.alibabaBaseUrl || "http://127.0.0.1:8080/v1";
      }

      const cleanBase = baseUrl.replace(/\/+$/, "");
      const startTime = Date.now();

      try {
        let testUrl = `${cleanBase}/models`;
        const headers: Record<string, string> = {};
        if (rawKey) {
          headers["Authorization"] = `Bearer ${rawKey}`;
        }

        // Special handling for Gemini native vs OpenAI compatible
        if (input.provider === "gemini" && !cleanBase.includes("openai") && rawKey) {
          testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(rawKey)}`;
        }

        const res = await fetch(testUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(10_000),
        });

        const latencyMs = Date.now() - startTime;

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          const statusMessage = `HTTP ${res.status}: ${res.statusText} ${errText.slice(0, 150)}`;
          // Update last status
          await updateProviderStatus(ctx.db, ctx.practiceId, input.provider, "error", statusMessage);
          return {
            ok: false,
            message: statusMessage,
            latencyMs,
          };
        }

        const data = (await res.json().catch(() => ({}))) as any;
        const count = Array.isArray(data?.data) ? data.data.length : Array.isArray(data?.models) ? data.models.length : 0;
        const statusMessage = `OK (${latencyMs} ms, ${count} modelov)`;

        await updateProviderStatus(ctx.db, ctx.practiceId, input.provider, "ok", statusMessage);

        return {
          ok: true,
          message: statusMessage,
          latencyMs,
          modelCount: count,
        };
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        const msg = err?.name === "TimeoutError" ? "Časový limit vypršal (10s timeout)" : err?.message || "Chyba pripojenia";
        await updateProviderStatus(ctx.db, ctx.practiceId, input.provider, "error", msg);
        return {
          ok: false,
          message: msg,
          latencyMs,
        };
      }
    }),

  /**
   * Fetch model list from endpoint, enrich with capabilities, and cache in DB.
   */
  fetchModels: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        provider: z.enum(["openai", "gemini", "alibaba"]),
        baseUrl: z.string().optional(),
        apiKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(extAiSettings)
        .where(
          and(
            eq(extAiSettings.practiceId, ctx.practiceId),
            eq(extAiSettings.isActive, true),
            isNull(extAiSettings.deletedAt),
          ),
        )
        .limit(1);

      let rawKey = input.apiKey?.trim() || "";
      if (rawKey.startsWith("••••") || !rawKey) {
        try {
          if (input.provider === "openai") rawKey = decryptAiApiKey(existing?.openaiApiKeyEncrypted);
          if (input.provider === "gemini") rawKey = decryptAiApiKey(existing?.geminiApiKeyEncrypted);
          if (input.provider === "alibaba") rawKey = decryptAiApiKey(existing?.alibabaApiKeyEncrypted);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Uložený API kľúč sa nepodarilo dešifrovať. Zadajte ho znova.",
          });
        }
      }

      let baseUrl = input.baseUrl?.trim() || "";
      if (!baseUrl) {
        if (input.provider === "openai") baseUrl = existing?.openaiBaseUrl || "http://127.0.0.1:8080/v1";
        if (input.provider === "gemini") baseUrl = existing?.geminiBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/";
        if (input.provider === "alibaba") baseUrl = existing?.alibabaBaseUrl || "http://127.0.0.1:8080/v1";
      }

      const cleanBase = baseUrl.replace(/\/+$/, "");
      const models: CachedAiModel[] = [];

      try {
        let testUrl = `${cleanBase}/models`;
        const headers: Record<string, string> = {};
        if (rawKey) {
          headers["Authorization"] = `Bearer ${rawKey}`;
        }

        if (input.provider === "gemini" && !cleanBase.includes("openai") && rawKey) {
          testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(rawKey)}`;
        }

        const res = await fetch(testUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(12_000),
        });

        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as any;
          const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];

          for (const item of rawList) {
            const id = (item?.id || item?.name || "").replace(/^models\//, "");
            if (!id) continue;

            const lower = id.toLowerCase();
            const isVision = lower.includes("vision") || lower.includes("-vl") || lower.includes("vl-") || lower.includes("4o") || lower.includes("flash") || lower.includes("pro");
            const isImage = lower.includes("image") || lower.includes("t2i") || lower.includes("dall-e") || lower.includes("imagen") || lower.includes("flux");
            const isVideo = lower.includes("video") || lower.includes("t2v") || lower.includes("i2v") || lower.includes("wan");

            models.push({
              id,
              name: item?.displayName || item?.name || id,
              contextLength: item?.context_length,
              isVision,
              isImageGeneration: isImage,
              isVideoGeneration: isVideo,
            });
          }
        }
      } catch {
        // Handled below with presets fallback
      }

      // If remote returned nothing or for Alibaba/Gemini, merge standard well-known presets
      if (input.provider === "alibaba") {
        for (const preset of DEFAULT_ALIBABA_PRESETS) {
          if (!models.some((m) => m.id === preset.id)) {
            models.push(preset);
          }
        }
      } else if (input.provider === "gemini") {
        for (const preset of DEFAULT_GEMINI_PRESETS) {
          if (!models.some((m) => m.id === preset.id)) {
            models.push(preset);
          }
        }
      }

      // Cache into database
      if (existing) {
        const updateData: any = { updatedAt: new Date() };
        if (input.provider === "openai") updateData.openaiCachedModels = models;
        if (input.provider === "gemini") updateData.geminiCachedModels = models;
        if (input.provider === "alibaba") updateData.alibabaCachedModels = models;

        await ctx.db
          .update(extAiSettings)
          .set(updateData)
          .where(eq(extAiSettings.id, existing.id));
      }

      return {
        models,
        count: models.length,
      };
    }),

  /**
   * Live health check for local or remote AliProxy service.
   */
  checkAliProxyHealth: protectedProcedure.query(async () => {
    return checkAlibabaProxyHealth();
  }),
});

async function updateProviderStatus(
  db: any,
  practiceId: string,
  provider: "openai" | "gemini" | "alibaba",
  status: "ok" | "error",
  message: string,
) {
  const [existing] = await db
    .select()
    .from(extAiSettings)
    .where(
      and(
        eq(extAiSettings.practiceId, practiceId),
        eq(extAiSettings.isActive, true),
        isNull(extAiSettings.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) return;

  const patch: any = { updatedAt: new Date() };
  if (provider === "openai") {
    patch.openaiLastTestedAt = new Date();
    patch.openaiLastStatus = status;
    patch.openaiLastStatusMessage = message;
  } else if (provider === "gemini") {
    patch.geminiLastTestedAt = new Date();
    patch.geminiLastStatus = status;
    patch.geminiLastStatusMessage = message;
  } else if (provider === "alibaba") {
    patch.alibabaLastTestedAt = new Date();
    patch.alibabaLastStatus = status;
    patch.alibabaLastStatusMessage = message;
  }

  await db.update(extAiSettings).set(patch).where(eq(extAiSettings.id, existing.id));
}
