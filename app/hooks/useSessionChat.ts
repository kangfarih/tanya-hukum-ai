"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import type { RootState, AppDispatch } from "../src/lib/redux/store";
import {
  createSession,
  deleteSession as deleteSessionAction,
  renameSession as renameSessionAction,
  setActiveSession,
  appendMessage,
  appendStreamToken,
  setSessionStatus,
  setSessionError,
  replaceLastAssistantMessage,
  selectActiveSession,
  selectAllSessionsSorted,
  type ChatMessage,
} from "../src/lib/redux/slices/sessionSlice";

interface StreamEvent {
  type: "token" | "done" | "error";
  delta?: string;
  text?: string;
  model?: string;
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
      // Ignore malformed SSE frames
    }
  }

  return { events, remainder };
}

export function useSessionChat() {
  const dispatch = useDispatch<AppDispatch>();
  const activeSession = useSelector(selectActiveSession);
  const allSessions = useSelector(selectAllSessionsSorted);
  const activeSessionId = useSelector((state: RootState) => state.sessions.activeSessionId);
  
  const abortRef = useRef<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const createNewSession = useCallback(async (title?: string) => {
    const sessionId = uuidv4();
    
    // Create session on server
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, title }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data = await response.json();
      
      // Use the server-returned ID or the one we generated
      const finalId = data.id || sessionId;
      
      dispatch(createSession({ sessionId: finalId, title: data.title || title }));
      dispatch(setActiveSession(finalId));
      
      return finalId;
    } catch (err) {
      console.error("Error creating session:", err);
      // Fallback to local-only session
      dispatch(createSession({ sessionId, title }));
      dispatch(setActiveSession(sessionId));
      return sessionId;
    }
  }, [dispatch]);

  const sendMessage = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    let sessionId = activeSessionId;
    let isNewSession = false;

    // Create session if none exists
    if (!sessionId) {
      sessionId = await createNewSession();
      isNewSession = true;
    }

    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    // Get existing messages BEFORE adding new ones
    // For new sessions, there are no existing messages
    const existingSession = isNewSession ? null : allSessions.find(s => s.id === sessionId);
    const existingMessages = existingSession?.messages ?? [];
    
    // Build the messages array for API (existing + new user message)
    const messagesForAPI = [
      ...existingMessages.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: trimmed },
    ];

    // Add user message to Redux
    dispatch(appendMessage({
      sessionId,
      message: { role: "user", content: trimmed },
    }));

    // Add empty assistant message
    dispatch(appendMessage({
      sessionId,
      message: { role: "assistant", content: "" },
    }));

    dispatch(setSessionStatus({ sessionId, status: "streaming" }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: messagesForAPI,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Chat request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalText = "";

      while (true) {
        if (controller.signal.aborted) {
          throw new DOMException("Request aborted", "AbortError");
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseSseEvents(buffer);
        buffer = remainder;

        for (const event of events) {
          if (event.type === "token" && event.delta) {
            finalText += event.delta;
            dispatch(appendStreamToken({ sessionId, token: event.delta }));
          } else if (event.type === "done") {
            finalText = event.text ?? finalText;
            if (finalText) {
              dispatch(replaceLastAssistantMessage({ sessionId, content: finalText }));
            }
          } else if (event.type === "error" && event.message) {
            throw new Error(event.message);
          }
        }
      }

      // Handle remaining buffer
      if (buffer.trim()) {
        const { events } = parseSseEvents(`${buffer}\n\n`);
        for (const event of events) {
          if (event.type === "token" && event.delta) {
            finalText += event.delta;
            dispatch(appendStreamToken({ sessionId, token: event.delta }));
          }
          if (event.type === "done") {
            finalText = event.text ?? finalText;
          }
        }
      }

      dispatch(setSessionStatus({ sessionId, status: "idle" }));
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (isAbort) {
        dispatch(setSessionStatus({ sessionId, status: "idle" }));
      } else {
        const message = err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        dispatch(setSessionError({ sessionId, error: message }));
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [activeSessionId, allSessions, isLoading, dispatch, createNewSession]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    dispatch(setActiveSession(sessionId || null));
  }, [dispatch]);

  const deleteSession = useCallback(async (sessionId: string) => {
    // Delete from server
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Error deleting session from server:", err);
    }
    
    // Delete from Redux
    dispatch(deleteSessionAction(sessionId));
  }, [dispatch]);

  const renameSession = useCallback(async (sessionId: string, title: string) => {
    // Rename on server
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch (err) {
      console.error("Error renaming session on server:", err);
    }
    
    // Rename in Redux
    dispatch(renameSessionAction({ sessionId, title }));
  }, [dispatch]);

  return {
    activeSession: activeSession ?? null,
    activeSessionId,
    allSessions,
    isLoading,
    error,
    sendMessage,
    stop,
    selectSession,
    deleteSession,
    renameSession,
    createNewSession,
  };
}