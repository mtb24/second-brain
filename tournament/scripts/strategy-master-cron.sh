#!/usr/bin/env bash
# Runs the strategy-master OpenClaw agent turn through the model fallback wrapper.
# Primary: google/gemini-2.5-flash
# Fallback: ollama/llama3.2-16k:latest (see openclaw/skills/_shared/Modelfile.llama3.2-16k)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOURNAMENT_DIR="$(dirname "${SCRIPT_DIR}")"
BRAIN_ROOT="$(dirname "${TOURNAMENT_DIR}")"
ENV_FILE="${BRAIN_ROOT}/.env"

WRAPPER_PATH="${BRAIN_ROOT}/openclaw/skills/_shared/model-fallback-runner.sh"
PROMPT_FILE="${SCRIPT_DIR}/strategy-master-agent-prompt.txt"

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
fi

if [[ ! -x "${WRAPPER_PATH}" ]]; then
  echo "fallback wrapper missing or not executable: ${WRAPPER_PATH}" >&2
  exit 2
fi

if [[ ! -f "${PROMPT_FILE}" ]]; then
  echo "missing prompt file: ${PROMPT_FILE}" >&2
  exit 2
fi

PROMPT_TEXT="$(<"${PROMPT_FILE}")"

# Stable session id preserves continuity during model switch retries.
SESSION_ID="${STRATEGY_MASTER_SESSION_ID:-strategy-master-cron}"

"${WRAPPER_PATH}" -- /usr/bin/openclaw agent \
  --agent main \
  --session-id "${SESSION_ID}" \
  --message "${PROMPT_TEXT}" \
  --deliver
