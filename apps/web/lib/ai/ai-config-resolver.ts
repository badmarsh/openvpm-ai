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

export type AiFeatureKey =
  | "assistant"
  | "imagingRtg"
  | "voiceSoap"
  | "labParser"
  | "imageGeneration"
  | "videoGeneration"
  | "marketingCopy";

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
  const featureMapping = mappings[feature];

  if (!config || !featureMapping || featureMapping.provider === "default") {
    // Default system fallbacks per feature
    if (feature === "imageGeneration") {
      const ali = getAlibabaProxyConfig();
      return {
        provider: "alibaba",
        modelId: ALIBABA_DEFAULT_IMAGE_MODEL,
        baseUrl: ali.baseUrl,
        apiKey: ali.apiKey,
        size: "1024*1024",
      };
    }
    if (feature === "videoGeneration") {
      const ali = getAlibabaProxyConfig();
      return {
        provider: "alibaba",
        modelId: ALIBABA_DEFAULT_VIDEO_MODEL,
        baseUrl: ali.baseUrl,
        apiKey: ali.apiKey,
        duration: 5,
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

  if (provider === "openai" && config.openaiIsActive) {
    const apiKey = decryptAiApiKey(config.openaiApiKeyEncrypted);
    return {
      provider: "openai",
      modelId: model,
      baseUrl: config.openaiBaseUrl || undefined,
      apiKey: apiKey || undefined,
      temperature,
      maxTokens,
      size,
    };
  }

  if (provider === "gemini" && config.geminiIsActive) {
    const apiKey = decryptAiApiKey(config.geminiApiKeyEncrypted);
    const baseUrl = config.geminiBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/";
    return {
      provider: "gemini",
      modelId: model,
      baseUrl,
      apiKey: apiKey || undefined,
      temperature,
      maxTokens,
    };
  }

  if (provider === "alibaba" && config.alibabaIsActive) {
    const apiKey = decryptAiApiKey(config.alibabaApiKeyEncrypted);
    return {
      provider: "alibaba",
      modelId: model,
      baseUrl: config.alibabaBaseUrl || "http://127.0.0.1:8080/v1",
      apiKey: apiKey || undefined,
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
      const proxy = createOpenAICompatible({
        name: "fallback-provider",
        baseURL: baseUrl,
        apiKey,
      });
      return proxy(resolved.modelId || DEFAULT_AI_MODEL);
    }
  }

  const proxy = createOpenAICompatible({
    name: `${resolved.provider}-${feature}`,
    baseURL: resolved.baseUrl,
    apiKey: resolved.apiKey,
  });

  return proxy(resolved.modelId);
}
