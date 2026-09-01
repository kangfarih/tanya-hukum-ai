# app/ — TanyaHukum Next.js (Layer 1)

Streaming chat UI + API routes. The only always-on host (Vercel, Hobby/free).

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- `openai` SDK against **OpenAI-compatible** providers: Gemini, DeepSeek, or OpenRouter, switched by `LLM_PROVIDER`
- Gemini accepts either a single key or multiple comma-separated keys for automatic failover
- OpenRouter supports many free/open models; check the live model list because free offerings change often

## Run it
```bash
cp .env.local.example .env.local   # add GEMINI_API_KEY/GEMINI_API_KEYS, OPENROUTER_API_KEY, and/or DEEPSEEK_API_KEY
npm install
npm run dev
```

## Common free model examples
```env
# OpenRouter free examples
OPENROUTER_MODEL=openai/gpt-oss-20b:free
# OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
# OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
# OPENROUTER_MODEL=microsoft/phi-3-mini-4k-instruct:free
```

## Layer 1 status
- [x] Provider abstraction (`src/lib/llm.ts`) — Gemini/DeepSeek/OpenRouter by env var
- [x] SSE streaming route (`src/app/api/chat/route.ts`) — token-by-token, abort forwarded, 60s cap
- [x] Versioned system prompt (`src/prompts/system-v1.md`, canonical at repo-root `prompts/`)
- [x] Chat UI: token render, stop button, error + retry, dev token counter
- [ ] Early smoke-test deploy to Vercel (Week 2)
