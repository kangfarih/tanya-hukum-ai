#!/usr/bin/env bash
set -uo pipefail

PROMPT="${1:-}"
TIMEOUT_SECONDS="${2:-90}"
OPENCODE_BIN="${OPENCODE_BIN:-}"
MODEL="${OPENCODE_MODEL:-opencode/mimo-v2.5-free}"

if [[ -z "$PROMPT" ]]; then
  echo "Usage: $0 \"prompt\" [timeout-seconds]"
  exit 1
fi

if [[ -z "$OPENCODE_BIN" ]]; then
  if command -v opencode >/dev/null 2>&1; then
    OPENCODE_BIN="$(command -v opencode)"
  elif [[ -x "$HOME/.opencode/bin/opencode" ]]; then
    OPENCODE_BIN="$HOME/.opencode/bin/opencode"
  else
    echo "OPENCODE_NOT_FOUND"
    exit 40
  fi
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "PYTHON_NOT_FOUND"
  exit 41
fi

"$PYTHON_BIN" - "$PROMPT" "$TIMEOUT_SECONDS" "$OPENCODE_BIN" "$MODEL" <<'PY'
import re
import subprocess
import sys

prompt = sys.argv[1]
timeout = int(sys.argv[2])
opencode_bin = sys.argv[3]
model = sys.argv[4]

cmd = [opencode_bin, "run", prompt, "-m", model]

try:
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    combined = (proc.stdout or "") + "\n" + (proc.stderr or "")

    if proc.stdout:
        sys.stdout.write(proc.stdout)
    if proc.stderr:
        sys.stderr.write(proc.stderr)

    if proc.returncode != 0:
        if re.search(r"429|rate limit|quota|too many requests|queued|in queue|retry after|busy|overloaded", combined, re.I):
            print("OPENCODE_QUEUE_OR_LIMITED", file=sys.stderr)
            raise SystemExit(20)
        print(f"OPENCODE_FAILED: exit={proc.returncode}", file=sys.stderr)
        raise SystemExit(30)

    if not combined.strip():
        print("OPENCODE_EMPTY_RESPONSE", file=sys.stderr)
        raise SystemExit(30)

    if re.search(r"429|rate limit|quota|too many requests|queued|in queue|retry after|busy|overloaded", combined, re.I):
        print("OPENCODE_QUEUE_OR_LIMITED", file=sys.stderr)
        raise SystemExit(20)

except subprocess.TimeoutExpired:
    print("OPENCODE_TIMEOUT", file=sys.stderr)
    raise SystemExit(10)
except FileNotFoundError:
    print("OPENCODE_NOT_FOUND", file=sys.stderr)
    raise SystemExit(40)
PY

EXIT_CODE=$?

if [[ "$EXIT_CODE" -eq 10 ]]; then
  echo "Fallback: Opencode timed out. Use Copilot fallback." >&2
elif [[ "$EXIT_CODE" -eq 20 ]]; then
  echo "Fallback: Opencode is queued or rate-limited. Use Copilot fallback." >&2
elif [[ "$EXIT_CODE" -eq 30 ]]; then
  echo "Fallback: Opencode failed. Use Copilot fallback." >&2
elif [[ "$EXIT_CODE" -eq 40 ]]; then
  echo "Fallback: Opencode CLI not installed or not found." >&2
fi

exit "$EXIT_CODE"
