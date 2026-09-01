# TanyaHukum — an ID Legal Assistant

> **Ask Indonesian law. Every answer cites its source.**

[🔗 Live demo](https://tanyahukum.vercel.app) · *(to be deployed — hard milestone, Week 10)*

![Demo GIF](TBD)

---

## Problem

Legal answers are buried in unstructured Indonesian regulations (UU, PP, Perpres).
A normal search UI can't answer questions like *"Apa sanksi keterlambatan pelaporan?"* —
especially across documents, in Indonesian **or** English, with a citation back to the source.

## Approach

RAG over a curated corpus of official Indonesian public legal documents:

```
parse → chunk → embed → hybrid retrieve → cite → evaluate
```

- **Corpus:** official JDIHN documents (see [`corpus/`](corpus/README.md))
- **Storage:** one interface — Chroma (local dev) → pgvector on Neon (prod)
- **Models:** Gemini Flash (free) generation · DeepSeek (fallback + judge) · multilingual embeddings
- **Evals:** ground-truth dataset + graders, run in CI on every PR

## Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Local app quickstart

The web app lives in [`app/`](app/README.md) and uses a streaming chat API with OpenRouter failover. Use Yarn for install and local dev.

```bash
cd app
yarn install
yarn dev
```

Required env values:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

Fallback model order used by the route:

1. `meta-llama/llama-3.3-70b-instruct:free`
2. `deepseek/deepseek-r1:free`
3. `google/gemini-2.0-flash-exp:free`

The route accepts JSON in this shape:

```json
{
  "messages": [
    { "role": "user", "content": "Apa sanksi keterlambatan pelaporan?" }
  ]
}
```

It validates requests, caps history to the last 20 messages, streams tokens with SSE, and returns a JSON 503 error when all models fail.

## Eval results *(to be filled in Layer 4, Week 8–9)*

| Config | Accuracy | p50 latency | p95 latency | Cost/query |
|---|---|---|---|---|
| naive RAG | _ | _ | _ | _ |
| hybrid (BM25 + vector) | _ | _ | _ | _ |
| hybrid + rerank | _ | _ | _ | _ |
| + metadata filters | _ | _ | _ | _ |

## Cost & latency

TBD — target **$0/month** infrastructure (free tiers); model usage on free tiers with
pennies-level DeepSeek fallback for evals/judge.

## What I'd do next

- Personal document upload (currently read-only over the curated corpus — deliberate scoping)
- Tool-calling to cross-reference amended/repealed articles
- Proactive monitoring of new regulations (JDIHN feed)

## Repo structure

```
tanya-hukum-ai/
├── app/          # Next.js (UI + API routes) — Layer 1
├── pipeline/     # Python: corpus fetch, ingestion, evals (local + CI)
├── corpus/       # sources.jsonl manifest + pdf/
├── prompts/      # versioned system prompts
├── evals/        # dataset.jsonl + results
└── ...
```

## Sources & license

Indonesian public legal documents are **not protected by copyright**
(UU 28/2014, Pasal 42) → freely redistributable. Full source list in
[`corpus/sources.jsonl`](corpus/sources.jsonl).
