import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  citations?: number[];
  createdAt: number;
}

export type SessionStatus = "idle" | "sending" | "streaming" | "error";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  status: SessionStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SessionState {
  sessions: Record<string, ChatSession>;
  activeSessionId: string | null;
}

const initialState: SessionState = {
  sessions: {},
  activeSessionId: null,
};

function generateMessageId(): string {
  return uuidv4();
}

function generateSessionId(): string {
  return uuidv4();
}

function buildConversationTitle(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, " ");
  if (!cleaned) return "New chat";
  return cleaned.length > 40 ? `${cleaned.slice(0, 37).trim()}...` : cleaned;
}

const sessionSlice = createSlice({
  name: "sessions",
  initialState,
  reducers: {
    createSession: (state, action: PayloadAction<{ title?: string; sessionId?: string } | undefined>) => {
      const sessionId = action.payload?.sessionId ?? generateSessionId();
      const title = action.payload?.title ?? "New chat";
      const now = Date.now();

      const newSession: ChatSession = {
        id: sessionId,
        title,
        messages: [],
        status: "idle",
        error: null,
        createdAt: now,
        updatedAt: now,
      };

      state.sessions[sessionId] = newSession;
      state.activeSessionId = sessionId;
    },

    deleteSession: (state, action: PayloadAction<string>) => {
      const sessionId = action.payload;
      delete state.sessions[sessionId];

      if (state.activeSessionId === sessionId) {
        const remainingSessions = Object.values(state.sessions).sort(
          (a, b) => b.updatedAt - a.updatedAt
        );
        state.activeSessionId = remainingSessions[0]?.id ?? null;
      }
    },

    renameSession: (state, action: PayloadAction<{ sessionId: string; title: string }>) => {
      const { sessionId, title } = action.payload;
      const session = state.sessions[sessionId];
      if (session) {
        session.title = title;
        session.updatedAt = Date.now();
      }
    },

    setActiveSession: (state, action: PayloadAction<string | null>) => {
      state.activeSessionId = action.payload;
    },

    appendMessage: (
      state,
      action: PayloadAction<{ sessionId: string; message: Omit<ChatMessage, "id" | "createdAt"> }>
    ) => {
      const { sessionId, message } = action.payload;
      const session = state.sessions[sessionId];
      if (!session) return;

      const newMessage: ChatMessage = {
        ...message,
        id: generateMessageId(),
        createdAt: Date.now(),
      };

      session.messages.push(newMessage);
      session.updatedAt = Date.now();
    },

    appendStreamToken: (
      state,
      action: PayloadAction<{ sessionId: string; token: string }>
    ) => {
      const { sessionId, token } = action.payload;
      const session = state.sessions[sessionId];
      if (!session) return;

      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        lastMessage.content += token;
        session.updatedAt = Date.now();
      }
    },

    setSessionStatus: (
      state,
      action: PayloadAction<{ sessionId: string; status: SessionStatus }>
    ) => {
      const { sessionId, status } = action.payload;
      const session = state.sessions[sessionId];
      if (session) {
        session.status = status;
        session.updatedAt = Date.now();
      }
    },

    setSessionError: (
      state,
      action: PayloadAction<{ sessionId: string; error: string | null }>
    ) => {
      const { sessionId, error } = action.payload;
      const session = state.sessions[sessionId];
      if (session) {
        session.error = error;
        if (error) {
          session.status = "error";
        }
        session.updatedAt = Date.now();
      }
    },

    replaceLastAssistantMessage: (
      state,
      action: PayloadAction<{ sessionId: string; content: string; citations?: number[] }>
    ) => {
      const { sessionId, content, citations } = action.payload;
      const session = state.sessions[sessionId];
      if (!session) return;

      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        lastMessage.content = content;
        if (citations) {
          lastMessage.citations = citations;
        }
        session.updatedAt = Date.now();
      }
    },

    removeMessage: (
      state,
      action: PayloadAction<{ sessionId: string; messageIndex: number }>
    ) => {
      const { sessionId, messageIndex } = action.payload;
      const session = state.sessions[sessionId];
      if (!session) return;

      if (messageIndex >= 0 && messageIndex < session.messages.length) {
        session.messages.splice(messageIndex, 1);
        session.updatedAt = Date.now();
      }
    },

    setMessages: (
      state,
      action: PayloadAction<{ sessionId: string; messages: ChatMessage[] }>
    ) => {
      const { sessionId, messages } = action.payload;
      const session = state.sessions[sessionId];
      if (session) {
        session.messages = messages;
        session.updatedAt = Date.now();
      }
    },

    clearSessionMessages: (state, action: PayloadAction<string>) => {
      const sessionId = action.payload;
      const session = state.sessions[sessionId];
      if (session) {
        session.messages = [];
        session.error = null;
        session.status = "idle";
        session.updatedAt = Date.now();
      }
    },

    hydrateSessions: (state, action: PayloadAction<Record<string, ChatSession>>) => {
      state.sessions = action.payload;
      if (!state.activeSessionId || !state.sessions[state.activeSessionId]) {
        const sessions = Object.values(state.sessions).sort(
          (a, b) => b.updatedAt - a.updatedAt
        );
        state.activeSessionId = sessions[0]?.id ?? null;
      }
    },
  },
});

export const {
  createSession,
  deleteSession,
  renameSession,
  setActiveSession,
  appendMessage,
  appendStreamToken,
  setSessionStatus,
  setSessionError,
  replaceLastAssistantMessage,
  removeMessage,
  setMessages,
  clearSessionMessages,
  hydrateSessions,
} = sessionSlice.actions;

// Selectors
export const selectAllSessions = (state: { sessions: SessionState }) => state.sessions.sessions;

export const selectActiveSessionId = (state: { sessions: SessionState }) =>
  state.sessions.activeSessionId;

export const selectSessionById = (sessionId: string) =>
  createSelector([selectAllSessions], (sessions) => sessions[sessionId]);

export const selectActiveSession = createSelector(
  [selectAllSessions, selectActiveSessionId],
  (sessions, activeSessionId) => (activeSessionId ? sessions[activeSessionId] : null)
);

export const selectAllSessionsSorted = createSelector([selectAllSessions], (sessions) => {
  // Deduplicate by ID and sort
  const unique = new Map<string, ChatSession>();
  for (const session of Object.values(sessions)) {
    unique.set(session.id, session);
  }
  return Array.from(unique.values()).sort((a, b) => b.updatedAt - a.updatedAt);
});

export const selectSessionStatus = (sessionId: string) =>
  createSelector([selectAllSessions], (sessions) => sessions[sessionId]?.status ?? "idle");

export const selectSessionMessages = (sessionId: string) =>
  createSelector([selectAllSessions], (sessions) => sessions[sessionId]?.messages ?? []);

export default sessionSlice.reducer;