"""Download the corpus PDFs listed in corpus/sources.jsonl.

Usage:
    python pipeline/fetch_sources.py            # fetch everything missing
    python pipeline/fetch_sources.py --limit 5  # fetch up to 5
    python pipeline/fetch_sources.py --delay 1  # 1s between requests

Polite by default: skips already-downloaded files, small delay between requests,
and identifies itself with a descriptive User-Agent.

Note: JDIH government sites reset Python's TLS connections (urllib/httpx) but
accept curl — this script shells out to `curl` (ships with macOS).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "corpus" / "sources.jsonl"
PDF_DIR = ROOT / "corpus" / "pdf"

USER_AGENT = "tanya-hukum corpus fetcher (public portfolio project; polite)"


def load_manifest() -> list[dict]:
    entries: list[dict] = []
    with MANIFEST.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries


def save_manifest(entries: list[dict]) -> None:
    with MANIFEST.open("w", encoding="utf-8") as fh:
        for entry in entries:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download corpus PDFs from sources.jsonl")
    parser.add_argument("--limit", type=int, default=None, help="max documents to fetch")
    parser.add_argument("--delay", type=float, default=0.5, help="seconds between requests")
    args = parser.parse_args()

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    entries = load_manifest()
    fetched = 0

    for entry in entries:
        target = PDF_DIR / f"{entry['id']}.pdf"
        if target.exists() or not entry.get("download_url"):
            continue
        if args.limit is not None and fetched >= args.limit:
            break
        print(f"Fetching {entry['id']} ...")
        subprocess.run(
            ["curl", "-sL", "-A", USER_AGENT, "-o", str(target), entry["download_url"]],
            check=True,
        )
        entry["downloaded_at"] = time.strftime("%Y-%m-%d")
        fetched += 1
        time.sleep(args.delay)

    save_manifest(entries)
    done = sum(1 for e in entries if e.get("downloaded_at"))
    print(f"Done. {fetched} fetched now; {done} total downloaded.")


if __name__ == "__main__":
    main()
