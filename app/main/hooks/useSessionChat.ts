"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import type { RootState, AppDispatch } from "@/main/store/store";
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
  removeMessage,
  selectActiveSession,
  selectAllSessionsSorted,
  type ChatMessage,
  type ChatSession,
} from "@/main/store/slices/sessionSlice";

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

// Track active requests per session
const activeControllers = new Map<string, AbortController>();

export function useSessionChat() {
  const dispatch = useDispatch<AppDispatch>();
  const activeSession = useSelector(selectActiveSession);
  const allSessions = useSelector(selectAllSessionsSorted);
  const activeSessionId = useSelector((state: RootState) => state.sessions.activeSessionId);
  
  const [error, setError] = useState<string | null>(null);

  // Clean up all abort controllers on unmount
  useEffect(() => {
    return () => {
      activeControllers.forEach((controller) => controller.abort());
      activeControllers.clear();
    };
  }, []);

  // Check if a specific session is loading
  const isSessionLoading = useCallback((sessionId: string) => {
    const session = allSessions.find(s => s.id === sessionId);
    return session?.status === "streaming" || session?.status === "sending";
  }, [allSessions]);

  // Get loading state for active session
  const isLoading = activeSessionId ? isSessionLoading(activeSessionId) : false;

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

  const sendMessage = useCallback(async (input: string, targetSessionId?: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    let sessionId = targetSessionId || activeSessionId;
    let isNewSession = false;

    // Create session if none exists
    if (!sessionId) {
      sessionId = await createNewSession();
      isNewSession = true;
    }

    if (!sessionId) return;

    // Don't send if this specific session is already loading
    if (isSessionLoading(sessionId)) return;

    setError(null);

    // Get existing messages BEFORE adding new ones
    const existingSession = isNewSession ? null : allSessions.find(s => s.id === sessionId);
    const existingMessages = existingSession?.messages ?? [];
    
    // Build the messages array for API (existing + new user message)
    // Filter out empty assistant messages (from failed streams)
    const messagesForAPI = [
      ...existingMessages
        .filter(m => !(m.role === "assistant" && !m.content.trim()))
        .map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: trimmed },
    ];

    // Update session title from first message
    if (existingMessages.length === 0 && sessionId) {
      const title = trimmed.length > 40 ? trimmed.slice(0, 37).trim() + "..." : trimmed;
      dispatch(renameSessionAction({ sessionId, title }));
      // Also update on server
      fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }).catch(() => {});
    }

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
    activeControllers.set(sessionId, controller);

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
        
        // Remove the empty assistant message on error
        const currentSession = allSessions.find(s => s.id === sessionId);
        if (currentSession) {
          const lastIdx = currentSession.messages.length - 1;
          if (lastIdx >= 0 && currentSession.messages[lastIdx].role === "assistant" && !currentSession.messages[lastIdx].content) {
            dispatch(removeMessage({ sessionId, messageIndex: lastIdx }));
          }
        }
      }
    } finally {
      activeControllers.delete(sessionId);
    }
  }, [activeSessionId, allSessions, dispatch, createNewSession, isSessionLoading]);

  const stop = useCallback((sessionId?: string) => {
    const targetId = sessionId || activeSessionId;
    if (targetId) {
      const controller = activeControllers.get(targetId);
      if (controller) {
        controller.abort();
        activeControllers.delete(targetId);
      }
    }
  }, [activeSessionId]);

  const selectSession = useCallback((sessionId: string) => {
    setError(null);
    dispatch(setActiveSession(sessionId || null));
  }, [dispatch]);

  const deleteSession = useCallback(async (sessionId: string) => {
    // Stop any active stream for this session
    stop(sessionId);
    
    // Delete from server
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Error deleting session from server:", err);
    }
    
    // Delete from Redux
    dispatch(deleteSessionAction(sessionId));
  }, [dispatch, stop]);

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
    allSessions: allSessions as ChatSession[],
    isLoading,
    error,
    isSessionLoading,
    sendMessage,
    stop,
    selectSession,
    deleteSession,
    renameSession,
    createNewSession,
  } as const;
}