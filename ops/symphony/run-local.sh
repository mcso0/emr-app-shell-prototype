#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/Users/iseung-ug/Projects/emr-app-shell-prototype"
RUNNER_DIR="/Users/iseung-ug/Projects/openai-symphony/elixir"
KEYCHAIN_SERVICE="emr-symphony-linear-api-key"
WORKFLOW="$REPO_ROOT/ops/symphony/WORKFLOW.md"
PORT="4040"

usage() {
  cat <<'EOF'
Usage:
  ops/symphony/run-local.sh [options]

Options:
  --save-key       Prompt for LINEAR_API_KEY and save it to macOS Keychain.
  --forget-key     Delete the saved Linear API key from macOS Keychain.
  --security       Run the CSO security workflow instead of the general workflow.
  --workflow PATH  Run a specific workflow file.
  --port PORT      Start the dashboard on a custom port. Default: 4040.
  --no-dashboard   Run without the Phoenix dashboard.
  -h, --help       Show this help.

Key lookup order:
  1. Existing LINEAR_API_KEY environment variable.
  2. macOS Keychain item service: emr-symphony-linear-api-key
  3. Hidden one-time prompt for this shell session.
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

validate_key() {
  case "${LINEAR_API_KEY:-}" in
    lin_api_*) return 0 ;;
    *)
      echo "LINEAR_API_KEY must start with lin_api_." >&2
      exit 1
      ;;
  esac
}

save_key() {
  require_command security

  printf "Linear API key: "
  IFS= read -r -s key
  printf "\n"

  case "$key" in
    lin_api_*) ;;
    *)
      echo "Key looks wrong. Expected a value starting with lin_api_." >&2
      exit 1
      ;;
  esac

  security add-generic-password \
    -a "$USER" \
    -s "$KEYCHAIN_SERVICE" \
    -w "$key" \
    -U >/dev/null

  echo "Saved Linear API key to macOS Keychain service: $KEYCHAIN_SERVICE"
}

forget_key() {
  require_command security

  if security delete-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" >/dev/null 2>&1; then
    echo "Deleted macOS Keychain service: $KEYCHAIN_SERVICE"
  else
    echo "No saved key found for service: $KEYCHAIN_SERVICE"
  fi
}

load_key() {
  if [ -n "${LINEAR_API_KEY:-}" ]; then
    validate_key
    return
  fi

  if command -v security >/dev/null 2>&1; then
    LINEAR_API_KEY="$(security find-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
    export LINEAR_API_KEY
    if [ -n "$LINEAR_API_KEY" ]; then
      validate_key
      echo "Loaded LINEAR_API_KEY from macOS Keychain."
      return
    fi
  fi

  printf "Linear API key for this run: "
  IFS= read -r -s LINEAR_API_KEY
  printf "\n"
  export LINEAR_API_KEY
  validate_key
}

dashboard_args() {
  if [ -n "$PORT" ]; then
    printf '%s\n' --port "$PORT"
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --save-key)
      save_key
      exit 0
      ;;
    --forget-key)
      forget_key
      exit 0
      ;;
    --security)
      WORKFLOW="$REPO_ROOT/ops/symphony/WORKFLOW.security.md"
      shift
      ;;
    --workflow)
      WORKFLOW="${2:?Missing path after --workflow}"
      shift 2
      ;;
    --port)
      PORT="${2:?Missing port after --port}"
      shift 2
      ;;
    --no-dashboard)
      PORT=""
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_command mise
require_command codex

if [ ! -d "$RUNNER_DIR" ]; then
  echo "Symphony runner directory not found: $RUNNER_DIR" >&2
  echo "Clone and build the OpenAI Symphony Elixir runner first." >&2
  exit 1
fi

if [ ! -f "$WORKFLOW" ]; then
  echo "Workflow file not found: $WORKFLOW" >&2
  exit 1
fi

load_key

cd "$RUNNER_DIR"

exec mise exec -- ./bin/symphony \
  --i-understand-that-this-will-be-running-without-the-usual-guardrails \
  $(dashboard_args) \
  "$WORKFLOW"
