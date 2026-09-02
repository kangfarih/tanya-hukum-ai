"use client";

import { useLanguage } from "@/main/i18n/LanguageContext";
import { SendIcon, StopIcon } from "./icons";

type ChatInputProps = {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  onStop: () => void;
  isEmpty: boolean;
};

export function ChatInput({ input, onInputChange, onSubmit, isLoading, onStop, isEmpty }: ChatInputProps) {
  const { t } = useLanguage();

  return (
    <form
      className={`fixed bottom-0 left-0 right-0 z-10 flex flex-col gap-1 border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950 lg:left-72 ${isEmpty ? "items-center" : "items-start"}`}
      onSubmit={onSubmit}
    >
      <div className={`flex w-full items-center gap-2 ${isEmpty ? "max-w-2xl" : ""}`}>
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={t("placeholder")}
          disabled={isLoading}
          className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />

        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
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
  );
}
