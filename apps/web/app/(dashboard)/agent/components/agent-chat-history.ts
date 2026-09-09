export interface PersistedChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; input: unknown; error?: string | null }>;
  isError?: boolean;
}

const STORAGE_PREFIX = "openvpm_agent_chat_session";

export function getChatStorageKey(userId?: string): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : STORAGE_PREFIX;
}

export function loadPersistedChat(userId?: string): PersistedChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(getChatStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePersistedChat(
  messages: PersistedChatMessage[],
  userId?: string,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      getChatStorageKey(userId),
      JSON.stringify(messages.slice(-50)),
    );
  } catch (e) {
    console.warn("[agent] Failed to persist chat history:", e);
  }
}

export function clearPersistedChat(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(getChatStorageKey(userId));
  } catch (e) {
    console.warn("[agent] Failed to clear persisted chat:", e);
  }
}
