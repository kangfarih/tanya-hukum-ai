# Corpus

Curated Indonesian public legal/regulatory documents (UU, PP, Perpres).

- **Primary source:** JDIHN — `jdihn.go.id` (national one-stop legal document platform).
  Each doc page embeds the full PDF `attachmentUrl` (served from JDIH Setneg).
- **Manifest:** [`sources.jsonl`](sources.jsonl) — the **source of truth** (one JSON per document).
  Contains `page_url`, `download_url`, `downloaded_at` for every entry.
- **PDFs:** `pdf/` — **regenerated**, not committed. Run:
  ```bash
  python pipeline/discover_downloads.py   # fill download_url from JDIHN pages (as needed)
  python pipeline/fetch_sources.py        # download all PDFs from the manifest
  ```
- **License:** peraturan perundang-undangan are **not protected by copyright**
  (UU 28/2014, Pasal 42) → freely redistributable.
- **Status (2026-09-01):** 10/10 documents acquired and **verified text-extractable**
  (not scans). Target: 30–100 documents.

## Next (still open)

- [ ] Write 10 trial Q/A pairs against the corpus — facts must be unambiguous (gates evals)
