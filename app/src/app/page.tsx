"use client";

import { useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SseEvent {
  type: "token" | "done" | "error" | "aborted";
  delta?: string;
  message?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const showMetrics = process.env.NODE_ENV === "development";

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const history = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(history);
    setInput("");
    setBusy(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    let buffer = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let chunkAcc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkAcc += decoder.decode(value, { stream: true });
        const lines = chunkAcc.split("\n");
        chunkAcc = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as SseEvent;
          if (event.type === "token" && event.delta) {
            buffer += event.delta;
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: "assistant", content: buffer },
            ]);
          } else if (event.type === "error") {
            throw new Error(event.message ?? "stream failed");
          }
        }
      }

      setTokens((t) => t + Math.max(1, Math.round(buffer.length / 4)));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Stream failed — check your API key and try again.");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setBusy(false);
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            TanyaHukum
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ask Indonesian law. Every answer cites its source.
          </p>
        </div>
        {showMetrics && (
          <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            ~{tokens} tok
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
            Try: &ldquo;Apa sanksi keterlambatan pelaporan?&rdquo;
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "self-end bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "self-start bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            }`}
          >
            {m.content || (busy && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
        {error && (
          <button
            onClick={() => setError(null)}
            className="self-start rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            {error} · dismiss
          </button>
        )}
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Indonesian law…"
          disabled={busy}
          className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />
        {busy ? (
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
