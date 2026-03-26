#!/usr/bin/env bash
# Scheduled tournament round: runs CLI entrypoint, logs to OB1 via ingest-api,
# notifies Ken on Telegram (via OpenClaw CLI) if the round fails.
#
# Invoked by OpenClaw cron (isolated agent runs this script). See deploy notes in repo.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOURNAMENT_DIR="$(dirname "$SCRIPT_DIR")"
BRAIN_ROOT="$(dirname "$TOURNAMENT_DIR")"
ENV_FILE="${BRAIN_ROOT}/.env"

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

API_SECRET="${API_SECRET:?API_SECRET is required in ${ENV_FILE}}"
INGEST_URL="${INGEST_URL:-http://127.0.0.1:8000/ingest}"
TELEGRAM_TARGET="${TELEGRAM_TARGET:-7221971575}"

LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

cd "$TOURNAMENT_DIR"

set +e
node dist/index.js >"$LOG" 2>&1
RC=$?
set -e

OUT=$(cat "$LOG")
MAX=60000
if ((${#OUT} > MAX)); then
  OUT="${OUT:0:MAX}…(truncated)"
fi

ingest_text() {
  local body="$1"
  local source="$2"
  curl -sS -X POST "$INGEST_URL" \
    -H "Authorization: Bearer ${API_SECRET}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg c "$body" --arg s "$source" '{type:"text", content: $c, source: $s}')"
}

if [[ $RC -eq 0 ]]; then
  SUMMARY="[tournament-cron] Round completed OK.

${OUT}"
  ingest_text "$SUMMARY" "tournament-cron" || true
  exit 0
fi

FAIL_BODY="[tournament-cron] Round FAILED (exit ${RC}).

${OUT}"
ingest_text "$FAIL_BODY" "tournament-cron" || true

TG_MSG="Tournament cron failed (exit ${RC}).

${OUT}"
MAX_TG=3800
if ((${#TG_MSG} > MAX_TG)); then
  TG_MSG="${TG_MSG:0:MAX_TG}…(truncated)"
fi

/usr/bin/openclaw message send --channel telegram --target "$TELEGRAM_TARGET" -m "$TG_MSG" 2>&1 || true

exit "$RC"
