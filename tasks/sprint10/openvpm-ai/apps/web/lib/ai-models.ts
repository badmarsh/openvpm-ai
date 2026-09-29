/**
 * Centralised AI model defaults.
 *
 * Model selection is driven by ext_ai_settings (DB) and the AT proxy.
 * Env vars AI_MODEL / AGENT_MODEL are no longer used for model resolution.
 */

/** Default Gemini model served via the Cloudflare AT proxy. */
export const DEFAULT_AI_MODEL = 'gemini-3.8-flash';
