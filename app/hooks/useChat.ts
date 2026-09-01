"use client";

import { useCallback, useRef, useState } from "react";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface StreamEvent {
  type: "token" | "done" | "error";
  delta?: string;
  text?: string;
  message?: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const nextUserMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, nextUserMessage];

    setMessages(nextMessages);
    setIsLoading(true);
    setError(null);

    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    setMessages([...nextMessages, assistantMessage]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "The chat request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;

            if (event.type === "token" && event.delta) {
              buffer += event.delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: buffer };
                return updated;
              });
            }

            if (event.type === "error" && event.message) {
              throw new Error(event.message);
            }

            if (event.type === "done") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: event.text ?? buffer,
                };
                return updated;
              });
            }
          } catch {
            // Ignore malformed SSE frames; the stream should still continue.
          }
        }
      }
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "Something went wrong.";
      setError(nextError);
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: nextError,
        };
        return updated;
      });
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [isLoading, messages]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    stop,
  };
}
