import type { NextRequest } from "next/server";
import { streamChat, type ChatMessage } from "../../../lib/llm";
import { sessionStore } from "../../../lib/server/sessionStore";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface ChatRequestBody {
  sessionId?: string;
  messages: ChatMessage[];
}

export interface StreamEvent {
  type: "token" | "done" | "error";
  delta?: string;
  text?: string;
  model?: string;
  message?: string;
}

const MAX_HISTORY = 20;

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function validateMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    throw new Error("messages must be an array.");
  }

  const normalized: ChatMessage[] = messages.slice(-MAX_HISTORY).map((message) => {
    if (!message || typeof message !== "object") {
      throw new Error("Each message must be an object.");
    }

    const { role, content } = message as Partial<ChatMessage>;

    if (typeof role !== "string" || typeof content !== "string") {
      throw new Error("Each message needs a role and content string.");
    }

    const cleanedContent = content.trim();
    if (!cleanedContent) {
      throw new Error("Message content cannot be empty.");
    }

    return {
      role: (role === "user" || role === "assistant" ? role : "user") as "user" | "assistant",
      content: cleanedContent,
    };
  });

  return normalized;
}

function buildConversationTitle(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, " ");
  if (!cleaned) return "New chat";
  return cleaned.length > 40 ? `${cleaned.slice(0, 37).trim()}...` : cleaned;
}

/**
 * SSE endpoint: POST { sessionId?, messages } -> streams tokens from configured LLM provider
 * 
 * If sessionId is provided, the server manages conversation history.
 * Messages array is still accepted for backward compatibility but server-side
 * session history takes precedence when available.
 */
export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const requestBody = body as Partial<ChatRequestBody>;
  const { sessionId } = requestBody;

  let validatedMessages: ChatMessage[];
  try {
    validatedMessages = validateMessages(requestBody.messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request payload.";
    return jsonError(400, message);
  }

  // Get or create session
  let session = sessionId ? sessionStore.get(sessionId) : null;
  if (sessionId && !session) {
    // Session doesn't exist, create it
    session = sessionStore.create();
    // Update the session ID to match what client expects
    // Note: In a real DB, you'd use the client-provided ID
  }

  // Get the latest user message
  const lastUserMessage = validatedMessages[validatedMessages.length - 1];
  if (!lastUserMessage || lastUserMessage.role !== "user") {
    return jsonError(400, "Last message must be from user.");
  }

  // If we have a session, use server-side history
  let messagesForLLM: ChatMessage[];
  if (session) {
    // Append user message to session
    sessionStore.appendMessage(session.id, {
      role: "user",
      content: lastUserMessage.content,
    });

    // Get updated session with user message
    const updatedSession = sessionStore.get(session.id);
    messagesForLLM = updatedSession!.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Update title if this is the first message
    if (updatedSession!.messages.length === 1) {
      sessionStore.rename(updatedSession!.id, buildConversationTitle(lastUserMessage.content));
    }
  } else {
    // No session, use messages from client
    messagesForLLM = validatedMessages;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: StreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        const tokens: string[] = [];

        await streamChat(messagesForLLM, (delta: string) => {
          tokens.push(delta);
          send({ type: "token", delta });
        }, req.signal);

        const fullText = tokens.join("");

        // Save assistant response to session
        if (session) {
          sessionStore.appendMessage(session.id, {
            role: "assistant",
            content: fullText,
          });
        }

        send({
          type: "done",
          text: fullText,
          model: process.env.LLM_PROVIDER || "openrouter",
        });
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        if (isAbort) {
          send({ type: "error", message: "Request was cancelled." });
        } else if (error instanceof Error) {
          const message = error.message.includes("429")
            ? "The AI service is rate-limited. Please try again in a moment."
            : "The AI service is temporarily unavailable. Please try again later.";
          send({ type: "error", message });
        } else {
          send({ type: "error", message: "Stream failed." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}