export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export const CHAT_STORAGE_KEY = "tanyahukum.chats.v1";

export function getChats(): ChatConversation[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatConversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChat(chat: ChatConversation): void {
  if (typeof window === "undefined") return;

  const existing = getChats();
  const next = [...existing.filter((item) => item.id !== chat.id), chat].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );

  window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next));
}

export function deleteChat(chatId: string): void {
  if (typeof window === "undefined") return;

  const existing = getChats();
  const next = existing.filter((chat) => chat.id !== chatId);
  window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next));
}

export function buildConversationTitle(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, " ");
  if (!cleaned) return "New chat";
  return cleaned.length > 40 ? `${cleaned.slice(0, 37).trim()}...` : cleaned;
}

export function createConversationFromMessages(messages: ChatMessage[] = []): ChatConversation {
  const firstUser = messages.find((message) => message.role === "user")?.content ?? "";
  const now = Date.now();

  return {
    id: `chat-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: buildConversationTitle(firstUser),
    createdAt: now,
    updatedAt: now,
    messages,
  };
}
