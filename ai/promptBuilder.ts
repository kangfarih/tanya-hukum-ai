import fs from "fs/promises";
import path from "path";

/**
 * Loads the versioned system prompt (ai/prompts/system-v1.md) — committed, not inline.
 *
 * Candidates, in order:
 *   1. <repo>/prompts/system-v1.md            — monorepo local dev (app/ is a subfolder)
 *   2. app/ai/prompts/system-v1.md            — deployed copy when Vercel root = app/
 *
 * Keep the in-app copy in sync with the canonical file at the repo root.
 */
export async function readSystemPrompt(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "../prompts/system-v1.md"),
    path.resolve(process.cwd(), "ai/prompts/system-v1.md"),
  ];
  for (const file of candidates) {
    try {
      // Node-runtime only (route is server-rendered) — silence Turbopack's fs warning.
      return await fs.readFile(/* turbopackIgnore: true */ file, "utf8");
    } catch {
      // try next candidate
    }
  }
  throw new Error("system prompt not found — expected ai/prompts/system-v1.md");
}
