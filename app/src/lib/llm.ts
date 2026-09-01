import OpenAI from "openai";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ProviderConfig {
  name: "gemini" | "deepseek" | "openrouter";
  apiKey: string;
  baseURL: string;
  model: string;
}

function getGeminiApiKeys(): string[] {
  const rawKeys = process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? "";

  return rawKeys
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

/**
 * OpenAI-compatible providers — switch by env var (see .env.local.example).
 * This single abstraction is what makes L5's "cheap model for simple queries" trivial:
 * swap LLM_PROVIDER and the model env, and everything follows.
 */
function getConfig(): ProviderConfig {
  const provider = (process.env.LLM_PROVIDER ?? "openrouter").toLowerCase();

  if (provider === "deepseek") {
    return {
      name: "deepseek",
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      baseURL: "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    };
  }

  if (provider === "gemini") {
    return {
      name: "gemini",
      apiKey: getGeminiApiKeys()[0] ?? "",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    };
  }

  return {
    name: "openrouter",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    baseURL: "https://openrouter.ai/api/v1",
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
  };
}

export function getProviderName(): string {
  return getConfig().name;
}

export function getModelName(): string {
  return getConfig().model;
}

/**
 * Streams a chat completion token-by-token.
 * Supports mid-stream cancellation via an AbortSignal (propagated to the provider).
 */
export async function streamChat(
  messages: ChatMessage[],
  onToken: (delta: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const cfg = getConfig();
  const apiKeys = cfg.name === "gemini" ? getGeminiApiKeys() : [cfg.apiKey];

  if (apiKeys.length === 0) {
    throw new Error("No API key configured for the selected LLM provider.");
  }

  let lastError: unknown;

  for (const apiKey of apiKeys) {
    try {
      const client = new OpenAI({ apiKey, baseURL: cfg.baseURL });
      const stream = await client.chat.completions.create(
        {
          model: cfg.model,
          messages,
          stream: true,
        },
        { signal }
      );

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) onToken(delta);
      }

      return;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  if (lastError) {
    throw lastError;
  }
}
