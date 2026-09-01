# Architecture — TanyaHukum

This project is designed as a clear, interview-friendly legal AI system: a small web app, a retrieval layer, and a resilient AI provider stack.

## Components

| Layer | Where it lives | Notes |
|---|---|---|
| **app/** | Next.js + TypeScript — UI + API routes | Streaming chat UI and server route. |
| **pipeline/** | Python — fetch, ingest, evals | Runs locally and in CI; not a production host. |
| **corpus/** | Raw sources and manifests | Tracks public legal documents and source metadata. |
| **prompts/** | Versioned system prompts | Keeps the system message in repo-controlled files. |
| **evals/** | Data and grading scripts | Used to validate answer quality and stability. |

## Current runtime flow

```text
Browser
  -> Next.js app route
  -> validate request payload
  -> try Gemini first
  -> fallback to OpenRouter
  -> fallback to DeepSeek
  -> stream tokens back in SSE
```

This keeps the app resilient when one provider rate-limits or returns a model error.

## AI provider policy

The app intentionally uses a simple priority order for reliability and portfolio clarity:

1. Gemini (`models/gemini-3.6-flash`)
2. OpenRouter (`meta-llama/llama-3.3-70b-instruct`)
3. DeepSeek (`deepseek-chat`)

The route catches provider/model failures and tries the next provider automatically.

## Request validation and safety controls

The server route validates a JSON body shaped like:

```json
{
  "messages": [{ "role": "user", "content": "Apa sanksi keterlambatan pelaporan?" }]
}
```

It also:

- rejects empty payloads
- trims and validates message content
- caps the message history to the last 20 messages
- returns a clean 503 JSON error when every model fails

## Storage and retrieval direction

The project is intended to evolve toward a retrieval-backed legal assistant:

- local corpus of Indonesian legal documents
- chunking and metadata extraction
- retrieval for legal questions
- grounded answer generation with citation support

This is the natural next step after the Layer 1 app is stable.

## Why this structure works

The design keeps responsibilities clear:

- app layer handles user interaction and streaming
- model layer handles provider resilience
- corpus and eval layers handle data quality and correctness
- docs remain easy to explain in an interview and a GitHub README
