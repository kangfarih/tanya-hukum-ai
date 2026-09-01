import type { NextRequest } from "next/server";

import { streamChat, type ChatMessage } from "@/lib/llm";
import { readSystemPrompt } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby cap — comfortable for streamed answers

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

/** SSE endpoint: POST { messages } → streams token deltas back to the browser. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { messages?: ClientMessage[] };

  const history: ChatMessage[] = (body.messages ?? []).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const system: ChatMessage = { role: "system", content: await readSystemPrompt() };
  const messages = [system, ...history];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        let text = "";
        await streamChat(
          messages,
          (delta) => {
            text += delta;
            send({ type: "token", delta });
          },
          // Forward client cancellation to the provider.
          req.signal
        );
        send({ type: "done", text });
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        send(
          aborted
            ? { type: "aborted" }
            : { type: "error", message: "stream failed — try again" }
        );
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
