"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

function parseSseEvents(buffer: string): { events: StreamEvent[]; remainder: string } {
  const events: StreamEvent[] = [];
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n").map((line) => line.trim());
    const payload = lines.find((line) => line.startsWith("data:"))?.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    try {
      const event = JSON.parse(payload) as StreamEvent;
      events.push(event);
    } catch {
      // Ignore malformed SSE frames; keep buffering until the full frame arrives.
    }
  }

  return { events, remainder };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(async (input: string, baseMessages?: ChatMessage[]) => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const activeMessages = baseMessages ?? messagesRef.current;
    const nextMessages = baseMessages ? activeMessages : [...activeMessages, { role: "user", content: trimmed }];

    setIsLoading(true);
    setError(null);

    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    setMessages([...nextMessages, assistantMessage]);

    const controller = new AbortController();
    abortRef.current = controller;
    let finalText = "";

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
        if (controller.signal.aborted) {
          throw new DOMException("The request was aborted.", "AbortError");
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseEvents(buffer);
        buffer = parsed.remainder;

        for (const event of parsed.events) {
          if (event.type === "token" && event.delta) {
            finalText += event.delta;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (lastIndex < 0 || updated[lastIndex]?.role !== "assistant") return prev;
              updated[lastIndex] = { role: "assistant", content: finalText };
              return updated;
            });
          }

          if (event.type === "error" && event.message) {
            throw new Error(event.message);
          }

          if (event.type === "done") {
            finalText = event.text ?? finalText;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (lastIndex < 0 || updated[lastIndex]?.role !== "assistant") return prev;
              updated[lastIndex] = { role: "assistant", content: finalText };
              return updated;
            });
          }
        }
      }

      if (buffer.trim()) {
        const parsed = parseSseEvents(`${buffer}\n\n`);
        for (const event of parsed.events) {
          if (event.type === "token" && event.delta) {
            finalText += event.delta;
          }
          if (event.type === "done") {
            finalText = event.text ?? finalText;
          }
        }
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (isAbort) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex < 0 || updated[lastIndex]?.role !== "assistant") return prev;
          updated[lastIndex] = { role: "assistant", content: "Stopped." };
          return updated;
        });
        return;
      }

      const nextError = err instanceof Error ? err.message : "Something went wrong.";
      setError(nextError);
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex < 0 || updated[lastIndex]?.role !== "assistant") return prev;
        updated[lastIndex] = {
          role: "assistant",
          content: nextError,
        };
        return updated;
      });
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [isLoading]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  return {
    messages,
    setMessages,
    sendMessage,
    isLoading,
    error,
    stop,
  };
}
