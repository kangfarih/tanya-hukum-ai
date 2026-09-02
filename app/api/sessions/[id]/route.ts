import type { NextRequest } from "next/server";
import { sessionStore } from "@/server/sessionStore";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id] - Get session by ID with full message history
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = sessionStore.get(id);

    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    return Response.json({
      id: session.id,
      title: session.title,
      messages: session.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get session";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/sessions/[id] - Delete a session
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = sessionStore.delete(id);

    if (!deleted) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete session";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/sessions/[id] - Rename a session
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { title } = body as { title?: string };

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

    const renamed = sessionStore.rename(id, title.trim());

    if (!renamed) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const session = sessionStore.get(id);
    return Response.json({
      id: session!.id,
      title: session!.title,
      updatedAt: session!.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rename session";
    return Response.json({ error: message }, { status: 500 });
  }
}