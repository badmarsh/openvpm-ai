/**
 * Centralised AI model defaults.
 *
 * Every module that resolves a model from `AI_MODEL` / `AGENT_MODEL` env vars
 * should fall back to `DEFAULT_AI_MODEL` so the default stays consistent
 * across the agent runner, imaging, voice dictation, discharge, and the
 * health endpoint without each module hard-coding its own version string.
 */

/** Default Gemini model when neither `AI_MODEL` nor `AGENT_MODEL` is set. */
export const DEFAULT_AI_MODEL = "gemini-3.8-flash-medium";
