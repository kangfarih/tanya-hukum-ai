import type { NextRequest } from "next/server";
import { sessionStore } from "../../../lib/server/sessionStore";

export const runtime = "nodejs";

/**
 * POST /api/sessions - Create a new session
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = (body as { title?: string }).title;

    const session = sessionStore.create(title);

    return Response.json({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create session";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/sessions - List all sessions
 */
export async function GET() {
  try {
    const sessions = sessionStore.list();

    return Response.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        messageCount: s.messages.length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list sessions";
    return Response.json({ error: message }, { status: 500 });
  }
}