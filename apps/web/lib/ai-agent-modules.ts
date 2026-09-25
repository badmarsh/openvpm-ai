import { useSyncExternalStore } from "react";

/**
 * Client-side on/off state for AI agent modules
 * (Automations hub → tab "AI Agenti & Workflow").
 *
 * The toggles persist per device in localStorage and gate the matching UI
 * affordances: the inbox AI client suggestion ("suggest-client-action") and
 * the PDF "Import to stock" button ("parse-attachment-invoice"). Structural
 * modules ("sender-grouping", "wholesale-parsers") are always on.
 *
 * Follow-up (server-side): persist per-practice so the preference survives
 * device switches and can gate worker behaviour, not just the UI.
 */

export const AI_AGENT_STORAGE_KEY = "openvpm_ai_agents_enabled";

const CHANGE_EVENT = "openvpm:ai-agents-changed";

export function readAiAgentEnabled(id: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(AI_AGENT_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed[id] ?? true;
  } catch {
    return true;
  }
}

export function writeAiAgentEnabled(patch: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(AI_AGENT_STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    window.localStorage.setItem(
      AI_AGENT_STORAGE_KEY,
      JSON.stringify({ ...current, ...patch }),
    );
  } catch {
    // Non-fatal: the UI state still updates for this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/** Reactive read of one module flag (defaults to enabled). */
export function useAiAgentEnabled(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readAiAgentEnabled(id),
    () => true,
  );
}
