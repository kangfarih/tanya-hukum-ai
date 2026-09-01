/**
 * Server-side session store abstraction.
 * 
 * This interface defines the contract for session storage.
 * The current implementation uses an in-memory Map.
 * 
 * TODO: Swap for Postgres/Neon later without changing calling code.
 */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  citations?: number[];
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionStore {
  create(title?: string): ChatSession;
  get(id: string): ChatSession | null;
  appendMessage(id: string, message: Omit<ChatMessage, "id" | "createdAt">): ChatMessage | null;
  list(): ChatSession[];
  delete(id: string): boolean;
  rename(id: string, title: string): boolean;
  updateMessages(id: string, messages: ChatMessage[]): boolean;
}

/**
 * In-memory session store.
 * 
 * Each serverless function instance gets its own store.
 * For production, swap with a persistent database.
 */
class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, ChatSession> = new Map();

  create(title?: string): ChatSession {
    const now = Date.now();
    const session: ChatSession = {
      id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
      title: title ?? "New chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): ChatSession | null {
    return this.sessions.get(id) ?? null;
  }

  appendMessage(id: string, message: Omit<ChatMessage, "id" | "createdAt">): ChatMessage | null {
    const session = this.sessions.get(id);
    if (!session) return null;

    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };

    session.messages.push(newMessage);
    session.updatedAt = Date.now();
    return newMessage;
  }

  list(): ChatSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  rename(id: string, title: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.title = title;
    session.updatedAt = Date.now();
    return true;
  }

  updateMessages(id: string, messages: ChatMessage[]): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.messages = messages;
    session.updatedAt = Date.now();
    return true;
  }
}

// Singleton instance
// TODO: For production, swap with Postgres/Neon-backed implementation
export const sessionStore: SessionStore = new InMemorySessionStore();