import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Opt-in inference proxy speaking the OpenAI Chat Completions API, such as a
 * local Gemini proxy on `http://127.0.0.1:8045/v1`.
 *
 * Setting `AI_BASE_URL` alone enables this path and it takes precedence over the
 * provider inferred from the model id, so a `gemini-*` model reaches the proxy
 * instead of Vertex AI (which would demand a Google credential boundary the
 * proxy already holds). Leaving `AI_BASE_URL` blank keeps the Vertex/Anthropic
 * resolution exactly as it was, so this module is inert for existing deploys.
 */

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Chat Completions root, including the trailing `/v1` segment. */
export function inferenceProxyBaseUrl(): string | undefined {
  return nonBlank(process.env.AI_BASE_URL);
}

/** Whether model resolution should go through the OpenAI-compatible proxy. */
export function hasInferenceProxyConfiguration(): boolean {
  return Boolean(inferenceProxyBaseUrl());
}

/** Drop provider prefixes so `google/gemini-x` and `gemini-x` both resolve. */
function proxyModelId(modelId: string): string {
  return modelId.trim().replace(/^(google\/|models\/|anthropic\/|openai\/)/, "");
}

/** Build an AI SDK model instance served by the proxy. */
export function inferenceProxyModel(modelId: string): LanguageModel {
  const baseURL = inferenceProxyBaseUrl();
  if (!baseURL) {
    throw new Error("AI_BASE_URL must be set to resolve a proxy model.");
  }
  const proxy = createOpenAICompatible({
    name: "openvpm-inference-proxy",
    baseURL,
    apiKey: nonBlank(process.env.AI_API_KEY),
  });
  return proxy(proxyModelId(modelId));
}
