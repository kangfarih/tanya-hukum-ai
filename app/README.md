# app/ — TanyaHukum Next.js (Layer 1)

Streaming chat UI + API routes. The only always-on host (Vercel, Hobby/free).

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- `openai` SDK against **OpenAI-compatible** providers: Gemini (free) or DeepSeek, switched by `LLM_PROVIDER`

## Run it
```bash
cp .env.local.example .env.local   # add GEMINI_API_KEY (free) and/or DEEPSEEK_API_KEY
npm install
npm run dev
```

## Layer 1 status
- [x] Provider abstraction (`src/lib/llm.ts`) — Gemini/DeepSeek by env var
- [x] SSE streaming route (`src/app/api/chat/route.ts`) — token-by-token, abort forwarded, 60s cap
- [x] Versioned system prompt (`src/prompts/system-v1.md`, canonical at repo-root `prompts/`)
- [x] Chat UI: token render, stop button, error + retry, dev token counter
- [ ] Early smoke-test deploy to Vercel (Week 2)
