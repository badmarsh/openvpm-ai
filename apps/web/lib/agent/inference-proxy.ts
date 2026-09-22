import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * AT inference proxy routed via Cloudflare tunnel.
 *
 * The proxy base URL is sourced exclusively from the `ext_ai_settings` DB table
 * (set in Dokploy environment tab). No AI_BASE_URL / AI_API_KEY / AI_MODEL env
 * vars should be present in .env or .env.production.local — those are now
 * managed solely through the OpenVPM AI Settings UI → ext_ai_settings.
 *
 * For the local dev / agent proxy path the base URL defaults to the Cloudflare
 * AT tunnel so the dev machine does not need any extra env entries.
 */

/** Cloudflare AT proxy — the single routing point for all Gemini calls. */
const AT_PROXY_BASE_URL = "https://chamber-scientific-acres-vary.trycloudflare.com/v1";

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Chat Completions root URL.
 * Reads AT_PROXY_URL env var only as an escape hatch (e.g. for a different
 * tunnel URL); otherwise uses the hardcoded Cloudflare tunnel.
 * The old AI_BASE_URL var is intentionally no longer consulted.
 */
export function inferenceProxyBaseUrl(): string {
  return nonBlank(process.env.AT_PROXY_URL) ?? AT_PROXY_BASE_URL;
}

/** The AT proxy is always active — no env flag needed. */
export function hasInferenceProxyConfiguration(): boolean {
  return true;
}

/** Drop provider prefixes so `google/gemini-x` and `gemini-x` both resolve. */
function proxyModelId(modelId: string): string {
  return modelId.trim().replace(/^(google\/|models\/|anthropic\/|openai\/)/, "");
}

/** Build an AI SDK model instance served by the AT proxy. */
export function inferenceProxyModel(modelId: string, apiKey?: string): LanguageModel {
  const baseURL = inferenceProxyBaseUrl();
  const proxy = createOpenAICompatible({
    name: "openvpm-at-proxy",
    baseURL,
    // API key comes from ext_ai_settings; AT proxy accepts any non-empty bearer token
    apiKey: nonBlank(apiKey) ?? "at-proxy",
  });
  return proxy(proxyModelId(modelId));
}
