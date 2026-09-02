import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const FALLBACK_SUGGESTIONS = [
  "Apa sanksi keterlambatan pelaporan pajak?",
  "Bagaimana prosedur pengajuan keberatan?",
  "Apa syarat untuk mengajukan gugatan perdata?",
  "Bagaimana cara menghitung denda administrasi?",
];

// List of legal topics for randomization
const LEGAL_TOPICS = [
  "perdata",
  "pidana",
  "ketenagakerjaan",
  "pajak",
  "lingkungan",
  "digital",
  "korporasi",
  "hak asasi",
  "internasional",
  "konstitusi",
  "properti",
  "keluarga",
  "dagang",
  "ilmu pengetahuan",
  "kesehatan",
];

function getProviderConfig() {
  const provider = (process.env.LLM_PROVIDER ?? "openrouter").toLowerCase();

  if (provider === "deepseek") {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      baseURL: "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    };
  }

  if (provider === "gemini") {
    const geminiKey =
      process.env.GEMINI_API_KEYS?.split(",").map((key) => key.trim()).find(Boolean) ??
      process.env.GEMINI_API_KEY ?? "";

    return {
      apiKey: geminiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    };
  }

  return {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    baseURL: "https://openrouter.ai/api/v1",
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
  };
}

function parseSuggestions(rawContent: string): string[] {
  const content = rawContent.trim();
  if (!content) return [];

  const normalized = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(normalized) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8);
    }

    if (parsed && typeof parsed === "object") {
      const suggestions = (parsed as { suggestions?: unknown }).suggestions;
      if (Array.isArray(suggestions)) {
        return suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8);
      }
    }
  } catch {
    // Fall through to a more forgiving extraction below.
  }

  const fallbackMatch = normalized.match(/\[[\s\S]*\]/);
  if (fallbackMatch) {
    try {
      const parsed = JSON.parse(fallbackMatch[0]) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8);
      }
    } catch {
      // Ignore and return empty.
    }
  }

  return [];
}

export async function GET() {
  try {
    const provider = getProviderConfig();
    if (!provider.apiKey) {
      console.warn("No LLM API key configured for suggestions; returning fallback suggestions.");
      return Response.json({ suggestions: FALLBACK_SUGGESTIONS });
    }

    // Pick 2-3 random topics for this request
    const shuffledTopics = [...LEGAL_TOPICS].sort(() => Math.random() - 0.5);
    const selectedTopics = shuffledTopics.slice(0, 2 + Math.floor(Math.random() * 2));

    const openai = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
    });

    const response = await openai.chat.completions.create({
      model: provider.model,
      messages: [
        {
          role: "system",
          content: `Anda adalah asisten hukum Indonesia yang membantu menghasilkan pertanyaan contoh.
Buat 8 pertanyaan hukum yang unik, bervariasi, dan relevan dengan hukum Indonesia.
Pertanyaan harus mencakup berbagai topik hukum dan dalam Bahasa Indonesia yang baik.
Kembalikan HANYA array JSON berisi 8 string, tanpa teks tambahan.
Contoh: ["pertanyaan 1", "pertanyaan 2", "pertanyaan 3", "pertanyaan 4", "pertanyaan 5", "pertanyaan 6", "pertanyaan 7", "pertanyaan 8"]`,
        },
        {
          role: "user",
          content: `Buat 8 pertanyaan hukum yang beragam dengan fokus pada topik: ${selectedTopics.join(", ")}. Pastikan pertanyaan bervariasi dari yang praktis hingga teoritis.`,
        },
      ],
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content ?? "[]";
    const suggestions = parseSuggestions(content);

    if (suggestions.length === 0) {
      console.error("Invalid suggestions format:", content);
      return Response.json({ suggestions: FALLBACK_SUGGESTIONS });
    }

    return Response.json({ suggestions });
  } catch (error) {
    console.error("Suggestions API error:", error);
    return Response.json({ suggestions: FALLBACK_SUGGESTIONS });
  }
}