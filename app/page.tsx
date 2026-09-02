"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Modal } from "@/main/components/Modal";
import { Providers } from "@/main/components/Providers";
import { useAutoScroll } from "@/main/hooks/useAutoScroll";
import { useSessionChat } from "@/main/hooks/useSessionChat";
import { useLanguage } from "@/main/i18n/LanguageContext";
import { ChevronDownIcon } from "@/main/components/icons";
import { Sidebar } from "@/main/components/Sidebar";
import { EmptyState } from "@/main/components/EmptyState";
import { ChatMessage } from "@/main/components/ChatMessage";
import { ChatInput } from "@/main/components/ChatInput";

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
    sendMessage,
    stop,
    selectSession,
    deleteSession,
    renameSession,
  } = useSessionChat();

  const { showScrollButton, scrollToBottom, contentRef } = useAutoScroll(scrollContainerRef, {
    isStreaming: isLoading,
  });

  const currentMessages = activeSession?.messages ?? [];
  const isEmpty = currentMessages.length === 0;

  // Load suggestions from API when language changes
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const response = await fetch(`/api/suggestions?lang=${language}`);
        if (!response.ok) throw new Error(`Suggestions API returned ${response.status}`);

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
          setLocalSuggestions((prev) => {
            const merged = [...prev, ...nextSuggestions];
            if (typeof window !== "undefined") {
              localStorage.setItem("suggestions", JSON.stringify(merged));
            }
            return merged;
          });
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
        console.error("Failed to load suggestions:", error);
        setSuggestions([]);
      }
    };

    void loadSuggestions();
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
    
    setLocalSuggestions((prev) => {
      if (prev.length <= 4) return prev;
      const first4 = prev.slice(0, 4);
      const rest = prev.slice(4);
      const rotated = [...rest, ...first4];
      if (typeof window !== "undefined") {
        localStorage.setItem("suggestions", JSON.stringify(rotated));
      }
      return rotated;
    });
    
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
    if (localSuggestions.length > 0) {
      setSuggestions(localSuggestions.slice(0, 4));
    }
  }

  function handleSelectChat(sessionId: string) {
    selectSession(sessionId);
    setSidebarOpen(false);
  }

  return (
    <main className="flex h-screen w-full overflow-hidden">
      <Sidebar
        allSessions={allSessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        settingsOpen={settingsOpen}
        onSettingsToggle={() => setSettingsOpen((prev) => !prev)}
        settingsMenuRef={settingsMenuRef}
        language={language}
        onLanguageToggle={() => setLanguage(language === "id" ? "en" : "id")}
        onClearData={() => {
          setSettingsOpen(false);
          setShowClearConfirm(true);
        }}
      />

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

        <div ref={scrollContainerRef} className="relative flex flex-1 flex-col overflow-y-auto px-4 pb-24 pt-4 lg:px-6">
          {/* Content wrapper — ResizeObserver watches this for content growth */}
          <div ref={contentRef} className="flex flex-1 flex-col gap-3">
            {isEmpty ? (
              <EmptyState
                suggestions={suggestions}
                isLoading={isLoading}
                onSuggestionClick={(value) => void handleSuggestionClick(value)}
              />
            ) : (
              currentMessages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  index={index}
                  allMessages={currentMessages}
                  isLoading={isLoading}
                  editingIndex={editingIndex}
                  editDraft={editDraft}
                  onEditStart={(idx, content) => {
                    setEditingIndex(idx);
                    setEditDraft(content);
                  }}
                  onEditCancel={() => {
                    setEditingIndex(null);
                    setEditDraft("");
                  }}
                  onEditDraftChange={setEditDraft}
                  onEditAndResend={(idx) => void handleEditAndResend(idx)}
                  onRegenerate={(userContent) => void sendMessage(userContent)}
                />
              ))
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

          {/* Floating scroll-to-bottom button — stays at bottom of viewport */}
          {showScrollButton && (
            <div className="sticky bottom-3 z-10 mx-auto flex justify-center">
              <button
                type="button"
                onClick={() => scrollToBottom()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white shadow-xl transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                aria-label="Scroll to bottom"
              >
                <ChevronDownIcon />
              </button>
            </div>
          )}
        </div>

        <ChatInput
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={stop}
          isEmpty={isEmpty}
        />
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
                localStorage.clear();
                window.location.reload();
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              {t("clearAll")}
            </button>
          </>
        }
      >
        <p>{t("clearLocalDataDesc")}</p>
      </Modal>
    </main>
  );
}
