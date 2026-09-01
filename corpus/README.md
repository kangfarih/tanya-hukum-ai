# Corpus

Curated Indonesian public legal/regulatory documents (UU, PP, Perpres).

- **Primary source:** JDIHN — `jdihn.go.id` (national one-stop legal document platform)
- **Fallback:** JDIH Setneg — `jdih.setneg.go.id`
- **Manifest:** [`sources.jsonl`](sources.jsonl) — the source of truth (one JSON per document)
- **PDFs:** `pdf/` — downloaded by [`pipeline/fetch_sources.py`](../pipeline/fetch_sources.py)
- **License:** peraturan perundang-undangan are **not protected by copyright**
  (UU 28/2014, Pasal 42) → freely redistributable.
- **Target:** 30–100 documents, **text PDFs preferred** (scans break the MVP — verify in Week 1)

## Week 1 tasks

- [ ] Verify each `page_url` resolves and find the **download URL** (visit a few JDIHN
      doc pages, note the "Unduh" link pattern, fill `download_url` per entry)
- [ ] Confirm PDFs are **text-extractable** (not scans)
- [ ] Write 10 trial Q/A pairs against the corpus — facts must be unambiguous (gates evals)
- [ ] Commit manifest + PDFs
