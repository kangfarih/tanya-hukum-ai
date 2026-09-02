"use client";

import { useState } from "react";
import { MarkdownMessage } from "./MarkdownMessage";
import { EditIcon, SendIcon, CloseIcon, CopyIcon, RegenerateIcon } from "./icons";
import { getCitationIds, stripCitationMarkers, sourceCatalog } from "@/main/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/main/store/slices/sessionSlice";

type ChatMessageProps = {
  message: ChatMessageType;
  index: number;
  allMessages: ChatMessageType[];
  isLoading: boolean;
  editingIndex: number | null;
  editDraft: string;
  onEditStart: (index: number, content: string) => void;
  onEditCancel: () => void;
  onEditDraftChange: (value: string) => void;
  onEditAndResend: (index: number) => void;
  onRegenerate: (userContent: string) => void;
};

export function ChatMessage({
  message,
  index,
  allMessages,
  isLoading,
  editingIndex,
  editDraft,
  onEditStart,
  onEditCancel,
  onEditDraftChange,
  onEditAndResend,
  onRegenerate,
}: ChatMessageProps) {
  const content = message.content || (isLoading && index === allMessages.length - 1 ? "…" : "");

  if (message.role === "assistant") {
    return <AssistantMessage content={content} index={index} allMessages={allMessages} isLoading={isLoading} onRegenerate={onRegenerate} />;
  }

  return <UserMessage content={content} index={index} editingIndex={editingIndex} editDraft={editDraft} onEditStart={onEditStart} onEditCancel={onEditCancel} onEditDraftChange={onEditDraftChange} onEditAndResend={onEditAndResend} />;
}

function AssistantMessage({
  content,
  index,
  allMessages,
  isLoading,
  onRegenerate,
}: {
  content: string;
  index: number;
  allMessages: ChatMessageType[];
  isLoading: boolean;
  onRegenerate: (userContent: string) => void;
}) {
  const citationIds = getCitationIds(content);
  const visibleContent = stripCitationMarkers(content);
  const sources = citationIds
    .map((id) => sourceCatalog[id])
    .filter((source): source is typeof sourceCatalog[number] => Boolean(source));

  function handleRegenerate() {
    const baseMessages = allMessages.slice(0, index);
    const lastUser = [...baseMessages].reverse().find((entry) => entry.role === "user");
    if (!lastUser) return;
    onRegenerate(lastUser.content);
  }

  return (
    <div className="self-start max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 text-sm leading-relaxed text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
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
              onClick={handleRegenerate}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              title="Regenerate"
            >
              <RegenerateIcon />
            </button>

            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(content).catch(() => undefined)}
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

function UserMessage({
  content,
  index,
  editingIndex,
  editDraft,
  onEditStart,
  onEditCancel,
  onEditDraftChange,
  onEditAndResend,
}: {
  content: string;
  index: number;
  editingIndex: number | null;
  editDraft: string;
  onEditStart: (index: number, content: string) => void;
  onEditCancel: () => void;
  onEditDraftChange: (value: string) => void;
  onEditAndResend: (index: number) => void;
}) {
  return (
    <div className="max-w-[85%] self-end rounded-2xl bg-zinc-900 px-4 py-2 text-sm leading-relaxed text-white dark:bg-zinc-100 dark:text-zinc-900">
      <div className="space-y-2">
        <div className="whitespace-pre-wrap">{content}</div>

        {editingIndex === index ? (
          <div className="space-y-2">
            <textarea
              value={editDraft}
              onChange={(event) => onEditDraftChange(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-300 bg-white p-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onEditAndResend(index)}
                className="rounded bg-white p-1.5 text-black hover:bg-zinc-800 hover:text-white dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-700"
                title="Resend"
              >
                <SendIcon />
              </button>
              <button
                type="button"
                onClick={onEditCancel}
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
            onClick={() => onEditStart(index, content)}
            className="inline-flex items-center rounded bg-white p-1 text-black hover:bg-zinc-800 hover:text-white dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-700"
            title="Edit & resend"
          >
            <EditIcon />
          </button>
        )}
      </div>
    </div>
  );
}
