"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { MarkdownMessage } from "../components/MarkdownMessage";
import { useChat } from "../../hooks/useChat";
import {
  buildConversationTitle,
  createConversationFromMessages,
  deleteChat,
  getChats,
  saveChat,
  type ChatConversation,
  type ChatMessage,
} from "../lib/chatStorage";

type FeedbackValue = "up" | "down";

type CitationSource = {
  id: number;
  title: string;
  href: string;
};

const sourceCatalog: Record<number, CitationSource> = {
  1: {
    id: 1,
    title: "UU No. 6 Tahun 1983 tentang Ketentuan Umum dan Tata Cara Perpajakan",
    href: "https://peraturan.bpk.go.id/Details/47486/uu-no-6-tahun-1983",
  },
  2: {
    id: 2,
    title: "Peraturan Menteri Keuangan tentang tata cara keberatan pajak",
    href: "https://peraturan.bpk.go.id/Details/46085/permenkeu-no-50-tahun-2022",
  },
  3: {
    id: 3,
    title: "Undang-Undang No. 30 Tahun 2014 tentang Administrasi Pemerintahan",
    href: "https://peraturan.bpk.go.id/Details/38270/uu-no-30-tahun-2014",
  },
};

const suggestionPrompts = [
  "Apa sanksi keterlambatan pelaporan pajak?",
  "Bagaimana prosedur pengajuan keberatan?",
  "Apa perbedaan sengketa administrasi dan pidana?",
  "Apa yang dimaksud dengan pasal 27 UU ITE?",
];

function getCitationIds(content: string): number[] {
  const ids = Array.from(content.matchAll(/\[\^(\d+)\]/g), (match) => Number(match[1]));
  return [...new Set(ids)].sort((left, right) => left - right);
}

function stripCitationMarkers(content: string): string {
  return content.replace(/\[\^(\d+)\]/g, "").trim();
}

function sortConversations(items: ChatConversation[]) {
  return [...items].sort((left, right) => right.updatedAt - left.updatedAt);
}

function groupConversationDateLabel(date: number) {
  const oneDay = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diff = now - date;

  if (diff < oneDay) return "Hari ini";
  if (diff < oneDay * 2) return "Kemarin";
  if (diff < oneDay * 7) return "7 hari terakhir";
  return "Sebelumnya";
}

export default function Home() {
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<ChatConversation[]>(() => sortConversations(getChats()));
  const [activeChatId, setActiveChatId] = useState<string | null>(() => getChats()[0]?.id ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, FeedbackValue>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const { messages, setMessages, sendMessage, isLoading, error, stop } = useChat();

  const activeConversation = useMemo(
    () => conversations.find((chat) => chat.id === activeChatId) ?? null,
    [activeChatId, conversations],
  );

  const groupedConversations = useMemo(() => {
    const groups: Record<string, ChatConversation[]> = {
      "Hari ini": [],
      "Kemarin": [],
      "7 hari terakhir": [],
      "Sebelumnya": [],
    };

    for (const chat of sortConversations(conversations)) {
      groups[groupConversationDateLabel(chat.updatedAt)]?.push(chat);
    }

    return groups;
  }, [conversations]);

  const currentMessages = messages.length > 0 ? messages : activeConversation?.messages ?? [];
  const isEmpty = currentMessages.length === 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = input.trim();
    if (!value) return;

    let targetId = activeChatId;
    if (!targetId) {
      const created = createConversationFromMessages();
      setConversations((prev) => sortConversations([created, ...prev]));
      setActiveChatId(created.id);
      targetId = created.id;
    }

    const targetConversation = conversations.find((chat) => chat.id === targetId) ?? null;
    const baseMessages: ChatMessage[] = targetConversation?.messages ?? currentMessages;
    const nextMessages: ChatMessage[] = [...baseMessages, { role: "user", content: value }];
    const title = targetConversation?.title === "New chat" ? buildConversationTitle(value) : targetConversation?.title ?? "New chat";

    setConversations((prev) =>
      sortConversations(
        prev.map((chat) => (chat.id === targetId ? { ...chat, title, messages: nextMessages, updatedAt: Date.now() } : chat)),
      ),
    );
    setInput("");
    setMessages(nextMessages);
    setSidebarOpen(false);
    await sendMessage(value, nextMessages);
  }

  async function handleSuggestionClick(value: string) {
    const targetId = activeChatId ?? (() => {
      const created = createConversationFromMessages();
      setConversations((prev) => sortConversations([created, ...prev]));
      setActiveChatId(created.id);
      return created.id;
    })();

    const targetConversation = conversations.find((chat) => chat.id === targetId) ?? null;
    const baseMessages: ChatMessage[] = targetConversation?.messages ?? [];
    const nextMessages: ChatMessage[] = [...baseMessages, { role: "user", content: value }];
    const title = targetConversation?.title === "New chat" ? buildConversationTitle(value) : targetConversation?.title ?? "New chat";

    setConversations((prev) =>
      sortConversations(
        prev.map((chat): ChatConversation =>
          chat.id === targetId ? { ...chat, title, messages: nextMessages, updatedAt: Date.now() } : chat,
        ),
      ),
    );
    setMessages(nextMessages);
    setInput("");
    await sendMessage(value, nextMessages);
  }

  async function handleEditAndResend(index: number) {
    const nextValue = editDraft.trim();
    if (!nextValue || !activeChatId) return;

    const nextMessages: ChatMessage[] = currentMessages.slice(0, index);
    nextMessages.push({ role: "user", content: nextValue });

    setEditingIndex(null);
    setEditDraft("");
    setMessages(nextMessages);
    setConversations((prev) =>
      sortConversations(
        prev.map((chat): ChatConversation =>
          chat.id === activeChatId
            ? { ...chat, messages: nextMessages, updatedAt: Date.now(), title: chat.title === "New chat" ? buildConversationTitle(nextValue) : chat.title }
            : chat,
        ),
      ),
    );
    await sendMessage(nextValue, nextMessages);
  }

  function handleNewChat() {
    const created = createConversationFromMessages();
    setConversations((prev) => sortConversations([created, ...prev]));
    setActiveChatId(created.id);
    setMessages([]);
    setSidebarOpen(false);
  }

  function handleSelectChat(chatId: string) {
    const nextActive = conversations.find((chat) => chat.id === chatId);
    setActiveChatId(chatId);
    setMessages(nextActive?.messages ?? []);
    setSidebarOpen(false);
    setRenameId(null);
  }

  function handleDeleteChat(chatId: string) {
    const confirmed = window.confirm("Hapus percakapan ini?");
    if (!confirmed) return;

    setConversations((prev) => {
      const next = prev.filter((chat) => chat.id !== chatId);
      if (chatId === activeChatId) {
        const nextActive = next[0] ?? null;
        setActiveChatId(nextActive?.id ?? null);
        setMessages(nextActive?.messages ?? []);
      }
      deleteChat(chatId);
      return next;
    });
  }

  function handleDuplicateChat(chatId: string) {
    const source = conversations.find((chat) => chat.id === chatId);
    if (!source) return;

    const duplicate: ChatConversation = {
      ...source,
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: `${source.title} (salinan)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: source.messages.map((message) => ({ ...message })),
    };

    setConversations((prev) => sortConversations([duplicate, ...prev]));
    setActiveChatId(duplicate.id);
    setMessages(duplicate.messages);
    saveChat(duplicate);
  }

  function handleRenameSave(chatId: string) {
    const trimmed = renameDraft.trim();
    if (!trimmed) return;

    setConversations((prev) => {
      const next = prev.map((chat) =>
        chat.id === chatId ? { ...chat, title: trimmed, updatedAt: Date.now() } : chat,
      );
      const active = next.find((chat) => chat.id === chatId);
      if (active) saveChat(active);
      return sortConversations(next);
    });
    setRenameId(null);
    setRenameDraft("");
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-[1600px] gap-0 px-0 py-0">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-[82vw] max-w-xs border-r border-zinc-200 bg-zinc-50 p-3 transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950 lg:static lg:w-72 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            Chat
          </h2>
          <button
            type="button"
            onClick={handleNewChat}
            className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            New chat
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto">
          {Object.entries(groupedConversations).map(([label, groupedChats]) => {
            if (groupedChats.length === 0) return null;

            return (
              <div key={label} className="space-y-2">
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {label}
                </p>

                {groupedChats.map((chat) => {
                  const isActive = activeChatId === chat.id;
                  return (
                    <div
                      key={chat.id}
                      className={`rounded-xl border p-2 ${
                        isActive
                          ? "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                          : "border-transparent bg-transparent hover:border-zinc-200 hover:bg-white dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                      }`}
                    >
                      {renameId === chat.id ? (
                        <div className="space-y-2">
                          <input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleRenameSave(chat.id)}
                              className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenameId(null);
                                setRenameDraft("");
                              }}
                              className="rounded-full border border-zinc-300 px-2 py-1 text-[10px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => handleSelectChat(chat.id)}
                            className="w-full text-left text-sm font-medium text-zinc-700 transition hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-50"
                          >
                            {chat.title}
                          </button>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRenameId(chat.id);
                                setRenameDraft(chat.title);
                              }}
                              className="text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateChat(chat.id)}
                              className="text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteChat(chat.id)}
                              className="text-[10px] uppercase tracking-wide text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-zinc-950/25 lg:hidden"
        />
      ) : null}

      <section className="flex min-h-screen flex-1 flex-col px-4 py-4 lg:px-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-full border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 lg:hidden"
            >
              Chats
            </button>

            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">TanyaHukum</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Ask Indonesian law. Every answer cites its source.</p>
            </div>
          </div>

          <Link
            href="/project-doc"
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Project docs
          </Link>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          {isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
              <div className="max-w-md space-y-2">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tanya hukum Indonesia</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Ajukan pertanyaan hukum dan dapatkan jawaban yang dirancang untuk dibaca dengan konteks dan sumber.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {suggestionPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void handleSuggestionClick(prompt)}
                    disabled={isLoading}
                    className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            currentMessages.map((message, index) => {
              const content = message.content || (isLoading && index === currentMessages.length - 1 ? "…" : "");
              const feedbackKey = `${message.role}-${index}`;
              const currentFeedback = feedbackByMessage[feedbackKey];

              if (message.role === "assistant") {
                const citationIds = getCitationIds(content);
                const visibleContent = stripCitationMarkers(content);
                const sources = citationIds
                  .map((id) => sourceCatalog[id])
                  .filter((source): source is CitationSource => Boolean(source));

                return (
                  <div
                    key={`${message.role}-${index}`}
                    className="self-start max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 text-sm leading-relaxed text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-300">
                        {citationIds.map((id) => (
                          <sup key={id} className="align-super text-[10px] text-blue-600 dark:text-blue-400">
                            [{id}]
                          </sup>
                        ))}
                      </div>

                      <MarkdownMessage content={visibleContent} className="text-sm leading-relaxed" />

                      {sources.length > 0 ? (
                        <details className="rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                          <summary className="cursor-pointer list-none font-medium">Sumber</summary>
                          <ul className="mt-2 space-y-2 pl-4">
                            {sources.map((source) => (
                              <li key={source.id}>
                                <a
                                  href={source.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-blue-600 underline decoration-2 underline-offset-2 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  {source.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(content).catch(() => undefined);
                          }}
                          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                        >
                          Copy
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const baseMessages = currentMessages.slice(0, index);
                            const lastUser = [...baseMessages].reverse().find((entry) => entry.role === "user");
                            if (!lastUser) return;
                            void sendMessage(lastUser.content, baseMessages);
                          }}
                          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                        >
                          Regenerate
                        </button>

                        <button
                          type="button"
                          onClick={() => setFeedbackByMessage((prev) => ({ ...prev, [feedbackKey]: "up" }))}
                          className={`text-xs font-medium ${currentFeedback === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-300"}`}
                        >
                          👍
                        </button>

                        <button
                          type="button"
                          onClick={() => setFeedbackByMessage((prev) => ({ ...prev, [feedbackKey]: "down" }))}
                          className={`text-xs font-medium ${currentFeedback === "down" ? "text-rose-600 dark:text-rose-400" : "text-zinc-600 dark:text-zinc-300"}`}
                        >
                          👎
                        </button>

                        <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                          {currentFeedback ? "Feedback saved locally" : "Feedback"}
                        </span>
                      </div>

                      {currentFeedback ? (
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          TODO: persist feedback to a backend or analytics store.
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "self-end bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "self-start bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="whitespace-pre-wrap">{content}</div>

                    {editingIndex === index ? (
                      <div className="space-y-2">
                        <textarea
                          value={editDraft}
                          onChange={(event) => setEditDraft(event.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-zinc-300 bg-white p-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleEditAndResend(index)}
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(null);
                              setEditDraft("");
                            }}
                            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIndex(index);
                          setEditDraft(content);
                        }}
                        className="text-xs font-medium text-zinc-300 underline-offset-2 hover:underline dark:text-zinc-400"
                      >
                        Edit & resend
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {error ? (
            <button
              onClick={() => undefined}
              className="self-start rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              {error}
            </button>
          ) : null}
        </div>

        <form className={`mt-4 flex items-center gap-2 ${isEmpty ? "justify-center" : ""}`} onSubmit={handleSubmit}>
          <div className={`flex w-full items-center gap-2 ${isEmpty ? "max-w-2xl" : ""}`}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={isEmpty ? "Tanyakan hukum Indonesia..." : "Ask about Indonesian law…"}
              disabled={isLoading}
              className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
            />

            {isLoading ? (
              <button
                type="button"
                onClick={stop}
                className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Send
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
