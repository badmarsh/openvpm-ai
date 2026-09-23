import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Inference proxy for OpenAI-compatible endpoints (AT proxy via Cloudflare tunnel).
 *
 * Configuration is managed entirely through the Dokploy environment tab:
 *   AT_PROXY_URL  — full base URL including /v1  (required)
 *   AT_PROXY_KEY  — bearer token for the proxy    (optional, defaults to "at-proxy")
 *
 * No values are hardcoded here. If AT_PROXY_URL is absent the proxy path is
 * inactive and runner.ts falls through to Vertex / Anthropic.
 */

function nonBlank(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

/**
 * Base URL read exclusively from the Dokploy environment tab.
 * Automatically normalizes the URL to end with `/v1` without duplicate slashes,
 * accepting both `https://...trycloudflare.com` and `https://...trycloudflare.com/v1`.
 */
export function inferenceProxyBaseUrl(): string | undefined {
  const raw = nonBlank(process.env.AT_PROXY_URL);
  if (!raw) return undefined;
  const stripped = raw.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? stripped : `${stripped}/v1`;
}

/** True when AT_PROXY_URL is present in the environment. */
export function hasInferenceProxyConfiguration(): boolean {
  return Boolean(inferenceProxyBaseUrl());
}

function proxyModelId(modelId: string): string {
  return modelId.trim().replace(/^(google\/|models\/|anthropic\/|openai\/)/, "");
}

/** Build an AI SDK model instance via the AT proxy. */
export function inferenceProxyModel(modelId: string, apiKey?: string): LanguageModel {
  const baseURL = inferenceProxyBaseUrl();
  if (!baseURL) throw new Error("AT_PROXY_URL is not set in the environment.");
  const proxy = createOpenAICompatible({
    name: "openvpm-at-proxy",
    baseURL,
    apiKey: nonBlank(apiKey) ?? nonBlank(process.env.AT_PROXY_KEY) ?? "at-proxy",
  });
  return proxy(proxyModelId(modelId));
}
