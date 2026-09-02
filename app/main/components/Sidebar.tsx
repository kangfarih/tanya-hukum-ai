"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/main/i18n/LanguageContext";
import type { ChatSession } from "@/main/store/slices/sessionSlice";
import { groupConversationDateLabel, formatRelativeTime } from "@/main/lib/utils";
import { ChatMenu } from "./ChatMenu";
import { SettingsIcon, GlobeIcon, TrashSmallIcon } from "./icons";

type SidebarProps = {
  allSessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  isOpen: boolean;
  onClose: () => void;
  settingsOpen: boolean;
  onSettingsToggle: () => void;
  settingsMenuRef: React.RefObject<HTMLDivElement | null>;
  language: "id" | "en";
  onLanguageToggle: () => void;
  onClearData: () => void;
};

export function Sidebar({
  allSessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  isOpen,
  onClose,
  settingsOpen,
  onSettingsToggle,
  settingsMenuRef,
  language,
  onLanguageToggle,
  onClearData,
}: SidebarProps) {
  const { t } = useLanguage();
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

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

  async function handleRenameSave(sessionId: string) {
    const trimmed = renameDraft.trim();
    if (!trimmed) return;

    await onRenameSession(sessionId, trimmed);
    setRenameId(null);
    setRenameDraft("");
  }

  return (
    <aside
      className={`flex w-72 flex-shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950 ${
        isOpen ? "fixed inset-y-0 left-0 z-30 w-[82vw] max-w-xs translate-x-0" : "fixed -translate-x-full lg:static lg:translate-x-0"
      }`}
    >
      <div className="mb-4 flex items-center justify-between p-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          {t("chat")}
        </h2>
        <button
          type="button"
          onClick={onNewChat}
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
                          onClick={() => onSelectSession(session.id)}
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
                            onDelete={() => onDeleteSession(session.id)}
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
          onClick={onSettingsToggle}
          className="flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label="Settings"
        >
          <SettingsIcon />
        </button>

        {settingsOpen && (
          <div
            ref={settingsMenuRef}
            className="absolute bottom-full left-3 mb-2 w-[calc(100%-1.5rem)] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={onLanguageToggle}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <GlobeIcon />
              {language === "id" ? "English" : "Bahasa Indonesia"}
            </button>
            <button
              type="button"
              onClick={onClearData}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-800"
            >
              <TrashSmallIcon />
              {t("clearLocalData")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
