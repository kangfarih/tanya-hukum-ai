"use client";

import { useState } from "react";
import Link from "next/link";

import { MarkdownMessage } from "../components/MarkdownMessage";
import { useChat } from "../../hooks/useChat";

export default function Home() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, isLoading, error, stop } = useChat();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;

    const value = input;
    setInput("");
    await sendMessage(value);
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-5xl flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            TanyaHukum
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ask Indonesian law. Every answer cites its source.
          </p>
        </div>

        <Link
          href="/project-doc"
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Project docs
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
            Try: &ldquo;Apa sanksi keterlambatan pelaporan?&rdquo;
          </div>
        )}

        {messages.map((message, index) => {
          const content = message.content || (isLoading && index === messages.length - 1 ? "…" : "");

          return (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                message.role === "user"
                  ? "self-end bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "self-start bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
              }`}
            >
              {message.role === "user" ? (
                <div className="whitespace-pre-wrap">{content}</div>
              ) : (
                <MarkdownMessage content={content} className="text-sm leading-relaxed" />
              )}
            </div>
          );
        })}

        {error && (
          <button
            onClick={() => undefined}
            className="self-start rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            {error}
          </button>
        )}
      </div>

      <form className="mt-4 flex items-center gap-2" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about Indonesian law…"
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
      </form>
    </main>
  );
}
