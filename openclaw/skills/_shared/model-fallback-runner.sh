#!/usr/bin/env bash
# OpenClaw model routing wrapper:
# - Primary model: google/gemini-2.5-flash
# - Local fallback: llama3.2-16k (Ollama) — OpenClaw requires >= 16k ctx; plain llama3.2 is 2048
# - Avoid Anthropic routing entirely
# - On primary rate-limit, set 60s cooldown and retry once on local fallback

set -euo pipefail

STATE_DIR_DEFAULT="${HOME}/.openclaw/workspace/state"
STATE_FILE_DEFAULT="${STATE_DIR_DEFAULT}/model-routing.json"
DEFAULT_TELEGRAM_TARGET="7221971575"

PRIMARY_MODEL_DEFAULT="google/gemini-2.5-flash"
FALLBACK_MODEL_DEFAULT="ollama/llama3.2-16k:latest"
FALLBACK_MODEL_SHORT="llama3.2-16k"

COOLDOWN_SECONDS_DEFAULT=60
OLLAMA_BASE_URL_DEFAULT="http://127.0.0.1:11434"
OPENCLAW_BIN_DEFAULT="/usr/bin/openclaw"
AGENT_ID_DEFAULT="main"

TELEGRAM_TARGET="${TELEGRAM_TARGET:-${DEFAULT_TELEGRAM_TARGET}}"
STATE_FILE="${OPENCLAW_MODEL_STATE_FILE:-${STATE_FILE_DEFAULT}}"
PRIMARY_MODEL="${OPENCLAW_PRIMARY_MODEL:-${PRIMARY_MODEL_DEFAULT}}"
FALLBACK_MODEL="${OPENCLAW_FALLBACK_MODEL:-${FALLBACK_MODEL_DEFAULT}}"
COOLDOWN_SECONDS="${OPENCLAW_MODEL_COOLDOWN_SECONDS:-${COOLDOWN_SECONDS_DEFAULT}}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-${OLLAMA_BASE_URL_DEFAULT}}"
OPENCLAW_BIN="${OPENCLAW_BIN:-${OPENCLAW_BIN_DEFAULT}}"
AGENT_ID="${OPENCLAW_AGENT_ID:-${AGENT_ID_DEFAULT}}"

usage() {
  cat <<'EOF'
Usage:
  model-fallback-runner.sh -- <openclaw-command-and-args>

Example:
  model-fallback-runner.sh -- /usr/bin/openclaw agent --agent main --session-id abc -m "hello"

Environment overrides:
  OPENCLAW_PRIMARY_MODEL             default: google/gemini-2.5-flash
  OPENCLAW_FALLBACK_MODEL            default: ollama/llama3.2-16k:latest
  OPENCLAW_MODEL_COOLDOWN_SECONDS    default: 60
  OPENCLAW_MODEL_STATE_FILE          default: ~/.openclaw/workspace/state/model-routing.json
  OPENCLAW_BIN                       default: /usr/bin/openclaw
  OPENCLAW_AGENT_ID                  default: main
  OLLAMA_BASE_URL                    default: http://127.0.0.1:11434
  TELEGRAM_TARGET                    default: 7221971575
EOF
}

require_bin() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: ${cmd}" >&2
    exit 2
  fi
}

notify_ken() {
  local text="$1"
  "${OPENCLAW_BIN}" message send --channel telegram --target "${TELEGRAM_TARGET}" -m "${text}" >/dev/null 2>&1 || true
}

ensure_state_file() {
  local dir
  dir="$(dirname "${STATE_FILE}")"
  mkdir -p "${dir}"
  if [[ ! -f "${STATE_FILE}" ]]; then
    jq -n \
      --arg route "primary" \
      --argjson cooldownUntilEpoch 0 \
      --arg lastReason "" \
      '{route:$route,cooldownUntilEpoch:$cooldownUntilEpoch,lastReason:$lastReason}' >"${STATE_FILE}"
  fi
}

state_get() {
  local key="$1"
  jq -r "${key}" "${STATE_FILE}" 2>/dev/null || true
}

state_set_route() {
  local route="$1"
  local cooldown_until="$2"
  local reason="$3"
  local tmp
  tmp="$(mktemp)"
  jq \
    --arg route "${route}" \
    --argjson cooldownUntilEpoch "${cooldown_until}" \
    --arg lastReason "${reason}" \
    '.route=$route | .cooldownUntilEpoch=$cooldownUntilEpoch | .lastReason=$lastReason' \
    "${STATE_FILE}" >"${tmp}"
  mv "${tmp}" "${STATE_FILE}"
}

configure_primary_route() {
  # Keep only Google primary + local fallback. Never configure Anthropic here.
  "${OPENCLAW_BIN}" models --agent "${AGENT_ID}" set "${PRIMARY_MODEL}" >/dev/null
  "${OPENCLAW_BIN}" models --agent "${AGENT_ID}" fallbacks clear >/dev/null
  "${OPENCLAW_BIN}" models --agent "${AGENT_ID}" fallbacks add "${FALLBACK_MODEL}" >/dev/null
}

configure_local_route() {
  # Force local model during cooldown window.
  "${OPENCLAW_BIN}" models --agent "${AGENT_ID}" set "${FALLBACK_MODEL}" >/dev/null
  "${OPENCLAW_BIN}" models --agent "${AGENT_ID}" fallbacks clear >/dev/null
}

ollama_ready_reason() {
  local tags_json
  if ! tags_json="$(curl -fsS "${OLLAMA_BASE_URL}/api/tags" 2>/dev/null)"; then
    echo "Ollama API not reachable at ${OLLAMA_BASE_URL}"
    return 1
  fi

  if ! jq -e \
    --arg short "${FALLBACK_MODEL_SHORT}" \
    '.models // [] | map(.name // "") | any(startswith($short))' <<<"${tags_json}" >/dev/null; then
    echo "Ollama reachable but ${FALLBACK_MODEL_SHORT} not present (on VPS: ollama pull llama3.2 && ollama create ${FALLBACK_MODEL_SHORT} -f ~/brain/openclaw/skills/_shared/Modelfile.llama3.2-16k)"
    return 1
  fi

  echo "ok"
  return 0
}

is_rate_limit_error() {
  local text="$1"
  if grep -Eiq '(^|[^a-z])(429|rate[[:space:]-]?limit|too many requests|resource has been exhausted|quota exceeded)([^a-z]|$)' <<<"${text}"; then
    return 0
  fi
  return 1
}

run_and_capture() {
  local output_file="$1"
  shift
  set +e
  "$@" >"${output_file}" 2>&1
  local rc=$?
  set -e
  return "${rc}"
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  require_bin jq
  require_bin curl
  require_bin "${OPENCLAW_BIN}"

  if [[ "${1:-}" != "--" ]]; then
    echo "expected -- before wrapped command" >&2
    usage
    exit 2
  fi
  shift
  if [[ "$#" -eq 0 ]]; then
    echo "missing wrapped command" >&2
    usage
    exit 2
  fi

  ensure_state_file

  local now route cooldown_until active_route
  now="$(date +%s)"
  route="$(state_get '.route')"
  cooldown_until="$(state_get '.cooldownUntilEpoch | tonumber? // 0')"

  if [[ "${route}" == "local" && "${now}" -lt "${cooldown_until}" ]]; then
    active_route="local"
    configure_local_route
  else
    active_route="primary"
    configure_primary_route
    state_set_route "primary" 0 ""
  fi

  local output_file rc output_text
  output_file="$(mktemp)"
  trap 'rm -f "${output_file}"' EXIT

  if run_and_capture "${output_file}" "$@"; then
    cat "${output_file}"
    exit 0
  fi
  rc=$?
  output_text="$(cat "${output_file}")"

  if [[ "${active_route}" != "primary" ]]; then
    # Already in fallback route and still failed; do not retry loop.
    cat "${output_file}" >&2
    exit "${rc}"
  fi

  if ! is_rate_limit_error "${output_text}"; then
    cat "${output_file}" >&2
    exit "${rc}"
  fi

  local cooldown_end
  cooldown_end="$((now + COOLDOWN_SECONDS))"
  state_set_route "local" "${cooldown_end}" "primary-rate-limit"

  local notify_prefix
  notify_prefix="[openclaw-fallback] Primary rate limit on ${PRIMARY_MODEL}."

  local ready_status
  ready_status="$(ollama_ready_reason || true)"
  if [[ "${ready_status}" != "ok" ]]; then
    notify_ken "${notify_prefix}
Fallback unavailable: ${ready_status}
Task stopped.
Cooldown before retrying primary: ${COOLDOWN_SECONDS}s."
    cat "${output_file}" >&2
    exit "${rc}"
  fi

  configure_local_route
  notify_ken "${notify_prefix}
Switched to ${FALLBACK_MODEL} for this task/session window.
Primary retry window opens in ${COOLDOWN_SECONDS}s."

  if run_and_capture "${output_file}" "$@"; then
    cat "${output_file}"
    exit 0
  fi
  rc=$?
  output_text="$(cat "${output_file}")"

  notify_ken "[openclaw-fallback] Local fallback ${FALLBACK_MODEL} failed after primary rate limit.
Task stopped.
Reason (truncated): ${output_text:0:300}"

  cat "${output_file}" >&2
  exit "${rc}"
}

main "$@"
