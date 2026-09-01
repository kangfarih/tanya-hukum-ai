#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/opencode-fallback.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/fake-opencode" <<'SH'
#!/usr/bin/env bash
set -u
MODE="${MODE:-success}"

if [[ "$1" == "run" ]]; then
  case "$MODE" in
    success)
      echo "I am opencode, the local agent wrapper."
      exit 0
      ;;
    queue)
      echo "queued in system; retry after 30s"
      exit 1
      ;;
    rate-limit)
      echo "429 Too Many Requests: rate limit exceeded"
      exit 1
      ;;
    timeout)
      sleep 120
      echo "this should not arrive"
      exit 0
      ;;
    fail)
      echo "provider unavailable"
      exit 1
      ;;
    *)
      echo "I am opencode, the local agent wrapper."
      exit 0
      ;;
  esac
fi

echo "unsupported fake-opencode invocation: $*" >&2
exit 1
SH
chmod +x "$TMP_DIR/fake-opencode"

run_case() {
  local label="$1"
  local mode="$2"
  local timeout_value="$3"
  local expected_exit="$4"

  echo "=== $label ==="
  MODE="$mode" OPENCODE_BIN="$TMP_DIR/fake-opencode" "$SCRIPT" "who are you?" "$timeout_value"
  local exit_code=$?
  echo "exit_code=$exit_code"

  if [[ "$exit_code" -ne "$expected_exit" ]]; then
    echo "FAIL: $label expected exit $expected_exit but got $exit_code"
    exit 1
  fi

  echo
}

run_case "happy path" "success" 20 0
run_case "queue path" "queue" 20 20
run_case "rate limit path" "rate-limit" 20 20
run_case "timeout path" "timeout" 5 10
run_case "generic failure path" "fail" 20 30

echo "All integration guard checks passed."
