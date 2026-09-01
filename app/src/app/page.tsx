"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { MarkdownMessage } from "../components/MarkdownMessage";
import { ReduxProvider } from "../components/ReduxProvider";
import { useSessionChat } from "../../hooks/useSessionChat";

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

function getCitationIds(content: string): number[] {
  const ids = Array.from(content.matchAll(/\[\^(\d+)\]/g), (match) => Number(match[1]));
  return [...new Set(ids)].sort((left, right) => left - right);
}

function stripCitationMarkers(content: string): string {
  return content.replace(/\[\^(\d+)\]/g, "").trim();
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

function ThreeDotIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="3" r="1.5" fill="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="13" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ChatMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setMenuPos(null);
      }
    }
    if (menuPos) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuPos]);

  function toggleMenu(event: React.MouseEvent) {
    event.stopPropagation();
    if (menuPos) {
      setMenuPos(null);
    } else if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 144 });
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="rounded p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
      >
        <ThreeDotIcon />
      </button>

      {menuPos ? (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 50 }}
          className="w-36 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            onClick={() => {
              onEdit();
              setMenuPos(null);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <EditIcon />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete();
              setMenuPos(null);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      ) : null}
    </>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 3C17.2626 2.73735 17.5744 2.52901 17.9176 2.38687C18.2608 2.24473 18.6286 2.17157 19 2.17157C19.3714 2.17157 19.7392 2.24473 20.0824 2.38687C20.4256 2.52901 20.7374 2.73735 21 3C21.2626 3.26264 21.471 3.57444 21.6131 3.91762C21.7553 4.2608 21.8284 4.62856 21.8284 5C21.8284 5.37144 21.7553 5.7392 21.6131 6.08238C21.471 6.42556 21.2626 6.73735 21 7L7.5 20.5L2 22L3.5 16.5L17 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="flex h-screen w-full items-center justify-center">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
      </main>
    );
  }

  return (
    <ReduxProvider>
      <HomeContent />
    </ReduxProvider>
  );
}

function HomeContent() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const suggestionsLoaded = useRef(false);

  const {
    activeSession,
    activeSessionId,
    allSessions,
    isLoading,
    error,
    sendMessage,
    stop,
    selectSession,
    deleteSession,
    renameSession,
  } = useSessionChat();

  const groupedConversations = useMemo(() => {
    const groups: Record<string, typeof allSessions> = {
      "Hari ini": [],
      "Kemarin": [],
      "7 hari terakhir": [],
      "Sebelumnya": [],
    };

    for (const session of allSessions) {
      groups[groupConversationDateLabel(session.updatedAt)]?.push(session);
    }

    return groups;
  }, [allSessions]);

  const currentMessages = activeSession?.messages ?? [];
  const isEmpty = currentMessages.length === 0;

  // Load suggestions from API (only once)
  useEffect(() => {
    if (suggestionsLoaded.current) return;
    suggestionsLoaded.current = true;

    const loadSuggestions = async () => {
      try {
        const response = await fetch("/api/suggestions");
        if (!response.ok) {
          console.error("Suggestions API error:", response.status);
          throw new Error(`Suggestions API returned ${response.status}`);
        }

        const text = await response.text();
        let data: { suggestions?: unknown } = {};

        if (text) {
          try {
            data = JSON.parse(text) as { suggestions?: unknown };
          } catch (parseError) {
            console.error("Failed to parse suggestions response:", parseError);
            throw parseError;
          }
        }

        const nextSuggestions = Array.isArray(data.suggestions)
          ? data.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : [];

        if (nextSuggestions.length > 0) {
          setSuggestions(nextSuggestions);
          return;
        }

        throw new Error("Suggestions payload was empty");
      } catch (error) {
        console.error("Failed to load suggestions:", error);
        setSuggestions([]);
      }
    };

    void loadSuggestions();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = input.trim();
    if (!value) return;

    setInput("");
    setSidebarOpen(false);
    await sendMessage(value);
  }

  async function handleSuggestionClick(value: string) {
    setInput("");
    setSidebarOpen(false);
    await sendMessage(value);
  }

  async function handleEditAndResend(index: number) {
    const nextValue = editDraft.trim();
    if (!nextValue || !activeSessionId) return;

    setEditingIndex(null);
    setEditDraft("");
    await sendMessage(nextValue);
  }

  function handleNewChat() {
    selectSession("");
    setSidebarOpen(false);
  }

  function handleSelectChat(sessionId: string) {
    selectSession(sessionId);
    setSidebarOpen(false);
    setRenameId(null);
  }

  async function handleDeleteChat(sessionId: string) {
    await deleteSession(sessionId);
  }

  async function handleRenameSave(sessionId: string) {
    const trimmed = renameDraft.trim();
    if (!trimmed) return;

    await renameSession(sessionId, trimmed);
    setRenameId(null);
    setRenameDraft("");
  }

  return (
    <main className="flex h-screen w-full overflow-hidden">
      <aside
        className={`flex w-72 flex-shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950 ${
          sidebarOpen ? "fixed inset-y-0 left-0 z-30 w-[82vw] max-w-xs translate-x-0" : "fixed -translate-x-full lg:static lg:translate-x-0"
        }`}
      >
        <div className="mb-4 flex items-center justify-between p-3">
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

        <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
          {Object.entries(groupedConversations).map(([label, groupedSessions]) => {
            if (groupedSessions.length === 0) return null;

            return (
              <div key={label} className="space-y-2">
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {label}
                </p>

                {groupedSessions.map((session) => {
                  const isActive = activeSessionId === session.id;
                  const isStreaming = session.status === "streaming" || session.status === "sending";
                  
                  return (
                    <div
                      key={session.id}
                      className={`group relative rounded-xl border p-2 ${
                        isActive
                          ? "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                          : "border-transparent bg-transparent hover:border-zinc-200 hover:bg-white dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                      }`}
                    >
                      {renameId === session.id ? (
                        <div className="space-y-2">
                          <input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleRenameSave(session.id);
                              if (event.key === "Escape") {
                                setRenameId(null);
                                setRenameDraft("");
                              }
                            }}
                            autoFocus
                            className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleRenameSave(session.id)}
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
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectChat(session.id)}
                            className="flex-1 truncate text-left text-sm font-medium text-zinc-700 transition hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-50"
                          >
                            {isStreaming && (
                              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                            )}
                            {session.title}
                          </button>

                          <ChatMenu
                            onEdit={() => {
                              setRenameId(session.id);
                              setRenameDraft(session.title);
                            }}
                            onDelete={() => handleDeleteChat(session.id)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const confirmed = window.confirm('Hapus semua riwayat chat?');
                if (!confirmed) return;
                window.location.reload();
              }
            }}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true">⚙️</span>
              Settings
            </span>
            <span className="text-xs text-red-600 dark:text-red-400">Delete all</span>
          </button>
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

      <section className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
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

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-24 pt-4 lg:px-6">
          {isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
              <div className="max-w-md space-y-2">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tanya hukum Indonesia</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Ajukan pertanyaan hukum dan dapatkan jawaban yang dirancang untuk dibaca dengan konteks dan sumber.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((prompt) => (
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

              if (message.role === "assistant") {
                const citationIds = getCitationIds(content);
                const visibleContent = stripCitationMarkers(content);
                const sources = citationIds
                  .map((id) => sourceCatalog[id])
                  .filter((source): source is CitationSource => Boolean(source));

                return (
                  <div
                    key={message.id}
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
                            void sendMessage(lastUser.content);
                          }}
                          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
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

        <form className={`fixed bottom-0 left-0 right-0 z-10 flex items-center gap-2 border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950 lg:left-72 ${isEmpty ? 'justify-center' : 'justify-start'}`} onSubmit={handleSubmit}>
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
                aria-label="Stop generating"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white transition disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <SendIcon />
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}