/**
 * Centralised AI model defaults.
 *
 * Model selection is driven by ext_ai_settings (DB) and the AT proxy.
 * Env vars AI_MODEL / AGENT_MODEL are no longer used for model resolution.
 */

/** Default model routed through the inference proxy (AliProxy qwen-max group). */
export const DEFAULT_AI_MODEL = 'qwen-max';

/**
 * Model family classification.
 *
 * Only Gemini (Vertex AI) and Claude (Anthropic) have a first-class provider
 * boundary in this app. Every other id — the qwen-* family above, for example —
 * is served exclusively by the inference proxy (AT_PROXY_URL / AI_BASE_URL),
 * which holds its own upstream credentials.
 *
 * This distinction is load-bearing: the Anthropic boundary must only be
 * selected for an actual Claude model. Treating "anything that is not Gemini"
 * as Claude routes e.g. qwen-max to api.anthropic.com, which reports the model
 * as configured and then fails at request time.
 */
export function isGeminiModel(modelId: string): boolean {
  return /^(google\/|models\/)?gemini/i.test(modelId.trim());
}

export function isAnthropicModel(modelId: string): boolean {
  return /^(anthropic\/)?claude/i.test(modelId.trim());
}
