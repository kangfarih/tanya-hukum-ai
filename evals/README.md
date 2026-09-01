# Evals — Layer 4 (Week 8–9) ⭐ THE DIFFERENTIATOR

Ground truth comes from the corpus: every Q/A pair is human-verified against a source
document. This is what makes the project hireable — do not skip it.

## Planned

- `dataset.jsonl` — **80–100 real questions** with expected answers
  - easy factual (citation-only) · multi-document synthesis · ambiguous
  - follow-up (needs memory) · out-of-scope (must refuse) · adversarial / prompt injection
- **Graders:** exact-match on retrieved chunk IDs · LLM-as-judge (DeepSeek — different
  provider than the generator → less bias) · must-refuse checks
- **CI (GitHub Actions):** smoke subset (~15 Qs) on every PR, full suite nightly/on merge
- **Ablations:** naive RAG vs. hybrid (BM25+vector) vs. hybrid+rerank vs. +metadata filters
- **Track:** accuracy + p50/p95 latency + cost-per-query

## Proof

A results table in the README with a real before → after delta.
