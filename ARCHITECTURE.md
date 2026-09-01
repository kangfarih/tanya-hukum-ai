# Architecture — TanyaHukum

_First version. Refined as layers land (kept updated from Week 6 per the plan)._

## Components

| Layer | Where it lives | Notes |
|---|---|---|
| **app/** | Next.js + TypeScript — UI + API routes | The **only always-on host** (Vercel, Hobby/free). |
| **pipeline/** | Python — fetch, ingest, evals | Runs **locally + GitHub Actions**, never hosted. |
| **corpus/** | Raw PDFs + `sources.jsonl` manifest | Committed; public data (not copyrighted, UU 28/2014 Ps. 42). |
| **prompts/** | Versioned system prompts | `system-v1.md` committed, not inline. |
| **evals/** | `dataset.jsonl` + results | Ground truth human-verified against source docs. |

## Request path (prod, from Week 10)

```
Browser ──SSE──▶ Next.js API route (Vercel)
                  ├── retrieve chunks from pgvector (Neon, free tier)
                  ├── embed query (multilingual model)
                  └── Gemini Flash streams the cited answer back
```

One hop → no cold starts, ~60s serverless cap is comfortable for streamed answers.

## Storage interface

Vector store behind one interface, swapped by env var:

- **dev:** Chroma (embedded, local)
- **prod:** pgvector on Neon (free tier)

`VECTOR_STORE=chroma|pgvector`

## Model providers (all OpenAI-compatible → one client abstraction)

- **Generation:** `GEMINI_MODEL` / `DEEPSEEK_MODEL` switch by env
- **Judge (evals):** DeepSeek — different provider than the generator → less judge bias
- **Embeddings:** multilingual (corpus is Indonesian; queries in ID/EN)
