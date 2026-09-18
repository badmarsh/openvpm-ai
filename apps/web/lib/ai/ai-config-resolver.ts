import { eq, and, isNull } from "drizzle-orm";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { extAiSettings, type CachedAiModel, type PracticeAiFeatureMappings } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { decryptAiApiKey } from "./ai-crypto";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";
import { configuredModel } from "@/lib/agent/runner";
import {
  ALIBABA_DEFAULT_IMAGE_MODEL,
  ALIBABA_DEFAULT_VIDEO_MODEL,
  getAlibabaProxyConfig,
} from "./alibaba-proxy";
import { DEFAULT_PRACTICE_FEATURE_MAPPINGS } from "./ai-presets";

export type AiFeatureKey =
  | "assistant"
  | "imagingRtg"
  | "voiceSoap"
  | "labParser"
  | "imageGeneration"
  | "videoGeneration"
  | "marketingCopy"
  | "deepThinking";

export interface ResolvedModelConfig {
  provider: "openai" | "gemini" | "alibaba" | "default";
  modelId: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  size?: string;
  duration?: number;
}

/**
 * Fetch raw practice AI configuration from ext_ai_settings.
 */
export async function getPracticeAiConfig(db: any, practiceId: string) {
  if (!practiceId) return null;
  const [row] = await db
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

  return row ?? null;
}

/**
 * Resolve provider connection parameters and model ID for a specific feature.
 */
export async function resolveFeatureConfig(
  db: any,
  practiceId: string,
  feature: AiFeatureKey,
): Promise<ResolvedModelConfig> {
  const config = await getPracticeAiConfig(db, practiceId);
  const mappings = (config?.featureMappings || {}) as PracticeAiFeatureMappings;
  const featureMapping = mappings[feature] || (config ? DEFAULT_PRACTICE_FEATURE_MAPPINGS[feature] : undefined);

  if (!config || !featureMapping || featureMapping.provider === "default") {
    // Default system fallbacks per feature
    if (feature === "imageGeneration") {
      const ali = getAlibabaProxyConfig();
      return {
        provider: "alibaba",
        modelId: "qwen-image-3.0",
        baseUrl: ali.baseUrl,
        apiKey: ali.apiKey,
        size: "1024*1024",
      };
    }
    if (feature === "videoGeneration") {
      const ali = getAlibabaProxyConfig();
      return {
        provider: "alibaba",
        modelId: "wan3.0-video",
        baseUrl: ali.baseUrl,
        apiKey: ali.apiKey,
        duration: 5,
      };
    }
    if (feature === "deepThinking") {
      return {
        provider: "gemini",
        modelId: "gemini-3.1-pro",
        temperature: featureMapping?.temperature ?? 0.1,
        maxTokens: featureMapping?.maxTokens ?? 8192,
      };
    }
    return {
      provider: "default",
      modelId: DEFAULT_AI_MODEL,
      temperature: featureMapping?.temperature ?? 0.2,
      maxTokens: featureMapping?.maxTokens ?? 4096,
    };
  }

  const { provider, model, temperature, maxTokens, size, duration } = featureMapping;

  function tryDecrypt(encrypted: string | null | undefined): string | undefined {
    if (!encrypted) return undefined;
    try {
      return decryptAiApiKey(encrypted) || undefined;
    } catch (err) {
      console.warn("[ai-config-resolver] Could not decrypt custom API key, falling back:", err instanceof Error ? err.message : err);
      return undefined;
    }
  }

  if (provider === "openai" && config.openaiIsActive) {
    const apiKey = tryDecrypt(config.openaiApiKeyEncrypted);
    return {
      provider: "openai",
      modelId: model,
      baseUrl: config.openaiBaseUrl || undefined,
      apiKey,
      temperature,
      maxTokens,
      size,
    };
  }

  if (provider === "gemini" && config.geminiIsActive) {
    const apiKey = tryDecrypt(config.geminiApiKeyEncrypted);
    const baseUrl = config.geminiBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/";
    return {
      provider: "gemini",
      modelId: model,
      baseUrl,
      apiKey,
      temperature,
      maxTokens,
    };
  }

  if (provider === "alibaba" && config.alibabaIsActive) {
    const apiKey = tryDecrypt(config.alibabaApiKeyEncrypted);
    return {
      provider: "alibaba",
      modelId: model,
      baseUrl: config.alibabaBaseUrl || "http://127.0.0.1:8080/v1",
      apiKey,
      temperature,
      maxTokens,
      size,
      duration,
    };
  }

  // Fallback to system default
  return {
    provider: "default",
    modelId: model || DEFAULT_AI_MODEL,
    temperature,
    maxTokens,
    size,
    duration,
  };
}

// Thought signature cache for multi-turn tool calling with Gemini 3.x models
const geminiThoughtSignatureCache = new Map<string, string>();

function createGeminiFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (init?.body && typeof init.body === "string") {
      try {
        const data = JSON.parse(init.body);
        if (Array.isArray(data.messages)) {
          for (const m of data.messages) {
            if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
              for (const tc of m.tool_calls) {
                const sig =
                  geminiThoughtSignatureCache.get(tc.id) ||
                  tc.extra_content?.google?.thought_signature ||
                  "skip_thought_signature_validator";
                tc.extra_content = {
                  ...tc.extra_content,
                  google: {
                    ...tc.extra_content?.google,
                    thought_signature: sig,
                  },
                };
              }
            }
          }
          init.body = JSON.stringify(data);
        }
      } catch {
        // Ignore JSON parse errors and proceed
      }
    }

    const response = await fetch(input, init);

    if (response.ok) {
      try {
        const clone = response.clone();
        const json = await clone.json();
        if (Array.isArray(json.choices)) {
          for (const choice of json.choices) {
            if (Array.isArray(choice.message?.tool_calls)) {
              for (const tc of choice.message.tool_calls) {
                const sig = tc.extra_content?.google?.thought_signature;
                if (tc.id && sig) {
                  geminiThoughtSignatureCache.set(tc.id, sig);
                  if (geminiThoughtSignatureCache.size > 500) {
                    const oldest = geminiThoughtSignatureCache.keys().next().value;
                    if (oldest) geminiThoughtSignatureCache.delete(oldest);
                  }
                }
              }
            }
          }
        }
      } catch {
        // Ignore JSON parse errors on response
      }
    }

    return response;
  };
}

/**
 * Build an AI SDK LanguageModel instance configured for the practice and feature.
 */
export async function resolvePracticeLanguageModel(
  db: any,
  practiceId: string,
  feature: AiFeatureKey,
): Promise<LanguageModel> {
  const resolved = await resolveFeatureConfig(db, practiceId, feature);

  if (resolved.provider === "default" || !resolved.baseUrl || !resolved.apiKey) {
    // Fall back to system configured model
    try {
      return configuredModel();
    } catch {
      // If Vertex/Anthropic is not set, try OpenAI compatible proxy if present
      const baseUrl = process.env.AI_BASE_URL || "http://127.0.0.1:8080/v1";
      const apiKey = process.env.AI_API_KEY || process.env.ALIPROXY_KEY || "aliproxy-local-key";
      const isGeminiFallback = baseUrl.includes("generativelanguage.googleapis.com");
      const proxy = createOpenAICompatible({
        name: "fallback-provider",
        baseURL: baseUrl,
        apiKey,
        fetch: isGeminiFallback ? createGeminiFetch() : undefined,
      });
      return proxy(resolved.modelId || DEFAULT_AI_MODEL);
    }
  }

  const isGemini =
    resolved.provider === "gemini" ||
    (resolved.baseUrl ? resolved.baseUrl.includes("generativelanguage.googleapis.com") : false);

  const proxy = createOpenAICompatible({
    name: `${resolved.provider}-${feature}`,
    baseURL: resolved.baseUrl,
    apiKey: resolved.apiKey,
    fetch: isGemini ? createGeminiFetch() : undefined,
  });

  return proxy(resolved.modelId);
}

