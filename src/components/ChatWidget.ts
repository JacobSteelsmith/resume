/**
 * Chat widget client-side logic with sessionStorage persistence.
 * Provides interfaces and utility functions for managing chat state.
 */

// --- Interfaces ---

export interface SourceAttribution {
  title: string;
  category: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceAttribution[];
  timestamp: number;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

// --- Constants ---

export const STORAGE_KEY = 'resume-chat-history';
export const MAX_CHARS = 500;
export const TIMEOUT_MS = 30000;

// --- Serialization / Deserialization ---

/**
 * Serialize an array of ChatMessages to a JSON string for sessionStorage.
 */
export function serializeMessages(messages: ChatMessage[]): string {
  return JSON.stringify(messages);
}

/**
 * Deserialize a JSON string from sessionStorage back into ChatMessage[].
 * Returns an empty array if the input is null, empty, or invalid JSON.
 */
export function deserializeMessages(raw: string | null): ChatMessage[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Validate each message has the required shape
    return parsed.filter((msg: unknown): msg is ChatMessage => {
      if (typeof msg !== 'object' || msg === null) return false;
      const m = msg as Record<string, unknown>;
      if (m.role !== 'user' && m.role !== 'assistant') return false;
      if (typeof m.content !== 'string') return false;
      if (typeof m.timestamp !== 'number') return false;
      return true;
    });
  } catch {
    return [];
  }
}

// --- sessionStorage helpers ---

/**
 * Save conversation history to sessionStorage.
 */
export function saveConversation(messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, serializeMessages(messages));
  } catch {
    // sessionStorage may be unavailable (private browsing, quota exceeded)
  }
}

/**
 * Load conversation history from sessionStorage.
 */
export function loadConversation(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return deserializeMessages(raw);
  } catch {
    return [];
  }
}

/**
 * Clear conversation history from sessionStorage.
 */
export function clearConversation(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
