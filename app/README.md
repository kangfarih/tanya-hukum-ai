# app/ — TanyaHukum Next.js (Layer 1)

Streaming chat UI + API routes. The only always-on host (Vercel, Hobby/free).

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- `openai` SDK against **OpenAI-compatible** providers: Gemini, DeepSeek, or OpenRouter, switched by `LLM_PROVIDER`
- Gemini accepts either a single key or multiple comma-separated keys for automatic failover
- OpenRouter models can change frequently; avoid stale `:free` slugs that return 404s

## Run it
```bash
cp .env.local.example .env.local   # add GEMINI_API_KEY/GEMINI_API_KEYS, OPENROUTER_API_KEY, and/or DEEPSEEK_API_KEY
yarn install
yarn dev
```

## Working OpenRouter model examples
```env
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct
# OPENROUTER_MODEL=deepseek/deepseek-r1
# OPENROUTER_MODEL=openai/gpt-4o-mini
```

## Layer 1 status
- [x] Provider abstraction (`src/lib/llm.ts`) — Gemini/DeepSeek/OpenRouter by env var
- [x] SSE streaming route (`src/app/api/chat/route.ts`) — token-by-token, abort forwarded, 60s cap
- [x] Multi-provider failover — tries OpenRouter → Gemini → DeepSeek automatically
- [x] Versioned system prompt (`src/prompts/system-v1.md`, canonical at repo-root `prompts/`)
- [x] Chat UI with markdown rendering (`src/components/MarkdownMessage.tsx`)
- [x] Local chat storage (`src/lib/chatStorage.ts`)
- [x] Request validation and history capping (max 20 messages)
- [ ] Early smoke-test deploy to Vercel (Week 2)
