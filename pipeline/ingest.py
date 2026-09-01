"""Layer 2 (Week 3-4): parse -> chunk -> embed -> vector store.

Stub for now. Will:
- read corpus/sources.jsonl + corpus/pdf/
- parse per format (PDF/Markdown/DOCX)
- chunk with a documented strategy (size, overlap, heading-aware)
- attach metadata (source file, heading, date) — required for citations
- embed with a multilingual model
- upsert into the vector store behind the storage interface (Chroma dev / pgvector prod)
"""
from __future__ import annotations


def main() -> None:
    print("ingest.py: not implemented yet — Layer 2 starts Week 3.")
    print(
        "TODO: parsers, chunking strategy (document the choice), metadata, "
        "multilingual embeddings, Chroma upsert via storage interface."
    )


if __name__ == "__main__":
    main()
