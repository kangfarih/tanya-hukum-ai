"""Fill `download_url` for corpus/sources.jsonl entries by inspecting JDIHN doc pages.

JDIHN (jdihn.go.id) embeds each document's metadata — including the full
`attachmentUrl` — as JSON inside the page. The actual PDF is served from
JDIH Setneg (jdih.setneg.go.id).

The government sites reset Python's TLS connections (urllib/httpx) but accept
curl — so this script shells out to `curl` (ships with macOS). Polite + idempotent.

Usage:
    python pipeline/discover_downloads.py            # only fill entries missing download_url
    python pipeline/discover_downloads.py --force    # re-discover all entries
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "corpus" / "sources.jsonl"

USER_AGENT = "tanya-hukum corpus fetcher (public portfolio project; polite)"
# The page embeds the full PDF URL (escaped quotes + \u0026 for &) inside JSON.
# Match up to the closing quote; the URL may end with the backslash of an escaped quote.
URL_RE = re.compile(r"https://jdih\.setneg\.go\.id/api/hukumproduk/pdf\?[^\"]+")


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


def fetch(url: str) -> str:
    return subprocess.run(
        ["curl", "-sL", "-A", USER_AGENT, url],
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def find_download_url(page_url: str) -> str | None:
    page = fetch(page_url)
    match = URL_RE.search(page)
    if not match:
        return None
    # \u0026 -> &, and drop the trailing backslash of an escaped closing quote.
    return match.group(0).replace("\\u0026", "&").rstrip("\\")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fill download_url from JDIHN doc pages")
    parser.add_argument("--force", action="store_true", help="re-discover all entries")
    parser.add_argument("--delay", type=float, default=0.5, help="seconds between requests")
    args = parser.parse_args()

    entries = load_manifest()
    updated = 0
    for entry in entries:
        if entry.get("download_url") and not args.force:
            continue
        url = find_download_url(entry["page_url"])
        if url:
            entry["download_url"] = url
            print(f"{entry['id']}: {url}")
            updated += 1
        else:
            print(f"{entry['id']}: NO download link found on {entry['page_url']}")
        time.sleep(args.delay)

    save_manifest(entries)
    print(f"Done. {updated} download URLs resolved.")


if __name__ == "__main__":
    main()
