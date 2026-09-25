/**
 * Centralised AI model defaults.
 *
 * Model selection is driven by ext_ai_settings (DB) and the AT proxy.
 * Env vars AI_MODEL / AGENT_MODEL are no longer used for model resolution.
 */

/** Default model routed through the inference proxy (AliProxy qwen-max group). */
export const DEFAULT_AI_MODEL = 'qwen-max';
