"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MarkdownMessage } from "@/main/components/MarkdownMessage";
import { Modal } from "@/main/components/Modal";
import { Providers } from "@/main/components/Providers";
import { useAutoScroll } from "@/main/hooks/useAutoScroll";
import { useSessionChat } from "@/main/hooks/useSessionChat";
import { useLanguage } from "@/main/i18n/LanguageContext";
import type { ChatSession } from "@/main/store/slices/sessionSlice";

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

function groupConversationDateLabel(date: number, lang: "id" | "en") {
  const oneDay = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diff = now - date;

  if (diff < oneDay) return lang === "id" ? "Hari ini" : "Today";
  if (diff < oneDay * 2) return lang === "id" ? "Kemarin" : "Yesterday";
  if (diff < oneDay * 7) return lang === "id" ? "7 hari terakhir" : "Last 7 days";
  return lang === "id" ? "Sebelumnya" : "Older";
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (weeks < 4) return `${weeks}w`;
  if (months < 12) return `${months}mo`;
  return `${years}y`;
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

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function RegenerateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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
    <Providers>
      <HomeContent />
    </Providers>
  );
}

function HomeContent() {
  const { language, setLanguage, t } = useLanguage();
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [localSuggestions, setLocalSuggestions] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load local suggestions from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("suggestions");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocalSuggestions(parsed);
        }
      }
    } catch {
      // Ignore malformed data
    }
  }, []);

  const {
    activeSession,
    activeSessionId,
    allSessions,
    isLoading,
    error,
    isSessionLoading,
    sendMessage,
    stop,
    selectSession,
    deleteSession,
    renameSession,
  } = useSessionChat();

  const { autoScroll, showScrollButton, scrollToBottom } = useAutoScroll(scrollContainerRef, {
    isStreaming: isLoading,
  });

  const groupedConversations = useMemo(() => {
    const groups: Record<string, ChatSession[]> = {
      [t("today")]: [],
      [t("yesterday")]: [],
      [t("lastWeek")]: [],
      [t("older")]: [],
    };

    for (const session of allSessions) {
      groups[groupConversationDateLabel(session.updatedAt, language)]?.push(session);
    }

    return groups;
  }, [allSessions, language, t]);

  const currentMessages = activeSession?.messages ?? [];
  const isEmpty = currentMessages.length === 0;

  // Load suggestions from API when language changes
  useEffect(() => {
    let cancelled = false;

    const loadSuggestions = async () => {
      try {
        const response = await fetch(`/api/suggestions?lang=${language}`);
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

        if (cancelled) return;

        if (nextSuggestions.length > 0) {
          // Push API suggestions to the end of local suggestions
          setLocalSuggestions((prev) => {
            const merged = [...prev, ...nextSuggestions];
            // Save to localStorage
            if (typeof window !== "undefined") {
              localStorage.setItem("suggestions", JSON.stringify(merged));
            }
            return merged;
          });
          // Always show first 4 suggestions on empty chat
          setSuggestions((prev) => {
            if (prev.length === 0) {
              return nextSuggestions.slice(0, 4);
            }
            return prev;
          });
          return;
        }

        throw new Error("Suggestions payload was empty");
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load suggestions:", error);
        setSuggestions([]);
      }
    };

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [language]);

  // Close settings menu when clicking outside
  useEffect(() => {
    if (!settingsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsOpen]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = input.trim();
    if (!value) return;

    setInput("");
    setSidebarOpen(false);
    await sendMessage(value);
  }

  // Silently fetch new suggestions in the background
  async function refreshSuggestions() {
    try {
      const response = await fetch(`/api/suggestions?lang=${language}`);
      if (!response.ok) return;

      const text = await response.text();
      let data: { suggestions?: unknown } = {};

      if (text) {
        try {
          data = JSON.parse(text) as { suggestions?: unknown };
        } catch {
          return;
        }
      }

      const newSuggestions = Array.isArray(data.suggestions)
        ? data.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];

      if (newSuggestions.length > 0) {
        setLocalSuggestions((prev) => {
          const merged = [...prev, ...newSuggestions];
          if (typeof window !== "undefined") {
            localStorage.setItem("suggestions", JSON.stringify(merged));
          }
          return merged;
        });
      }
    } catch {
      // Silent fail - suggestions are non-critical
    }
  }

  async function handleSuggestionClick(value: string) {
    setInput("");
    setSidebarOpen(false);
    
    // Rotate first 4 suggestions to the end of local suggestions
    setLocalSuggestions((prev) => {
      if (prev.length <= 4) return prev;
      const first4 = prev.slice(0, 4);
      const rest = prev.slice(4);
      const rotated = [...rest, ...first4];
      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("suggestions", JSON.stringify(rotated));
      }
      return rotated;
    });
    
    // Silently fetch new suggestions in the background
    void refreshSuggestions();
    
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
    // Show first 4 local suggestions when creating new chat
    if (localSuggestions.length > 0) {
      setSuggestions(localSuggestions.slice(0, 4));
    }
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
            {t("chat")}
          </h2>
          <button
            type="button"
            onClick={handleNewChat}
            className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t("newChat")}
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

                {groupedSessions.map((session, index) => {
                  const isActive = activeSessionId === session.id;
                  const isStreaming = session.status === "streaming" || session.status === "sending";
                  
                  return (
                    <div
                      key={`${session.id}-${index}`}
                      className={`group relative overflow-hidden rounded-xl border p-2 ${
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
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectChat(session.id)}
                            className="min-w-0 flex-1 text-left transition hover:text-zinc-900 dark:hover:text-zinc-50"
                          >
                            <span className="block truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                              {session.title}
                            </span>
                            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                              {formatRelativeTime(session.updatedAt)}
                            </p>
                          </button>

                          <div className="flex flex-shrink-0 items-center gap-1">
                            {isStreaming && (
                              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                            )}
                            <ChatMenu
                              onEdit={() => {
                                setRenameId(session.id);
                                setRenameDraft(session.title);
                              }}
                              onDelete={() => handleDeleteChat(session.id)}
                            />
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

        <div className="relative border-t border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>

          {settingsOpen && (
            <div
              ref={settingsMenuRef}
              className="absolute bottom-full left-3 mb-2 w-[calc(100%-1.5rem)] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => setLanguage(language === "id" ? "en" : "id")}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                {language === "id" ? "English" : "Bahasa Indonesia"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setShowClearConfirm(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                {t("clearLocalData")}
              </button>
            </div>
          )}
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
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("appName")}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("appTagline")}</p>
            </div>
          </div>
        </header>

        <div ref={scrollContainerRef} className="relative flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-24 pt-4 lg:px-6">
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

                      {!isLoading && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const baseMessages = currentMessages.slice(0, index);
                              const lastUser = [...baseMessages].reverse().find((entry) => entry.role === "user");
                              if (!lastUser) return;
                              void sendMessage(lastUser.content);
                            }}
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            title="Regenerate"
                          >
                            <RegenerateIcon />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(content).catch(() => undefined);
                            }}
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            title="Copy"
                          >
                            <CopyIcon />
                          </button>
                        </div>
                      )}
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
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => void handleEditAndResend(index)}
                            className="rounded bg-white p-1.5 text-black hover:bg-zinc-800 hover:text-white dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-700"
                            title="Resend"
                          >
                            <SendIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(null);
                              setEditDraft("");
                            }}
                            className="rounded bg-white p-1.5 text-black hover:bg-zinc-800 hover:text-white dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-700"
                            title="Cancel"
                          >
                            <CloseIcon />
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
                        className="inline-flex items-center rounded bg-white p-1 text-black hover:bg-zinc-800 hover:text-white dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-700"
                        title="Edit & resend"
                      >
                        <EditIcon />
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

          {/* Scroll-to-bottom button */}
          {showScrollButton && (
            <button
              type="button"
              onClick={() => scrollToBottom()}
              className="sticky bottom-2 mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-lg transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Scroll to bottom"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>

        <form className={`fixed bottom-0 left-0 right-0 z-10 flex flex-col gap-1 border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950 lg:left-72 ${isEmpty ? 'items-center' : 'items-start'}`} onSubmit={handleSubmit}>
          <div className={`flex w-full items-center gap-2 ${isEmpty ? "max-w-2xl" : ""}`}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("placeholder")}
              disabled={isLoading}
              className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
            />

            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
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
          <p className="w-full text-center text-[11px] text-zinc-400 dark:text-zinc-500">
            {t("disclaimer")}
          </p>
        </form>
      </section>

      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title={t("clearLocalData")}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                // Clear all localStorage
                localStorage.clear();
                // Clear Redux state by reloading
                window.location.reload();
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              {t("clearAll")}
            </button>
          </>
        }
      >
        <p>
          {t("clearLocalDataDesc")}
        </p>
      </Modal>
    </main>
  );
}