import OpenAI from "openai";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
}

export interface StreamEvent {
  type: "token" | "done" | "error";
  delta?: string;
  text?: string;
  model?: string;
  message?: string;
}

const EXTRA_PROVIDER_MODELS = [
  {
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    models: ["meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-r1", "openai/gpt-4o-mini"],
  },
  {
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey: process.env.GEMINI_API_KEYS?.split(",")[0]?.trim() ?? process.env.GEMINI_API_KEY ?? "",
    models: ["models/gemini-3.6-flash", "gemini-2.5-flash"],
  },
  {
    name: "deepseek",
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    models: ["deepseek-chat"],
  },
] as const;

const MAX_HISTORY = 20;

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function validateMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array.");
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
      role: role === "user" || role === "assistant" ? role : "user",
      content: cleanedContent,
    };
  });

  if (normalized.length === 0) {
    throw new Error("At least one valid message is required.");
  }

  return normalized;
}

/** SSE endpoint: POST { messages } -> streams tokens from OpenRouter with model failover. */
export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const requestBody = body as Partial<ChatRequestBody>;

  try {
    requestBody.messages = validateMessages(requestBody.messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request payload.";
    return jsonError(400, message);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: StreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      let lastError: unknown = null;

      try {
        for (const provider of EXTRA_PROVIDER_MODELS) {
          if (!provider.apiKey) {
            console.warn(`Skipping ${provider.name}: no API key configured.`);
            continue;
          }

          const client = new OpenAI({
            apiKey: provider.apiKey,
            baseURL: provider.baseURL,
          });

          for (const model of provider.models) {
            try {
              const response = await client.chat.completions.create(
                {
                  model,
                  messages: requestBody.messages,
                  stream: true,
                },
                { signal: req.signal }
              );

              let fullText = "";

              for await (const chunk of response) {
                if (req.signal.aborted) {
                  throw new DOMException("The request was aborted.", "AbortError");
                }

                const delta = chunk.choices[0]?.delta?.content;
                if (!delta) continue;

                fullText += delta;
                send({ type: "token", delta });
              }

              send({ type: "done", text: fullText, model: `${provider.name}:${model}` });
              controller.close();
              return;
            } catch (error) {
              lastError = error;
              console.warn(`${provider.name} model failed: ${model}`, error);
            }
          }
        }

        const friendlyMessage =
          lastError instanceof Error && lastError.message.includes("429")
            ? "The AI service is rate-limited right now. Please try again in a moment."
            : "The AI service is temporarily unavailable. Please try again in a moment.";

        send({ type: "error", message: friendlyMessage });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stream failed.";
        send({ type: "error", message });
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
