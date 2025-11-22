#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)
REPO_ROOT=$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd)

ENV_FILE=${ENV_FILE:-.env}

load_env_file() {
  local file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%$'\r'}"
    [[ -z "$line" || ${line:0:1} == "#" ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local value="${BASH_REMATCH[2]}"
      if [[ "$value" == "\""* && "$value" == *"\"" ]]; then
        value=${value#\"}
        value=${value%\"}
      fi
      export "${key}=${value}"
    fi
  done <"$file"
}

if [[ -f "${REPO_ROOT}/${ENV_FILE}" ]]; then
  load_env_file "${REPO_ROOT}/${ENV_FILE}"
fi

REQUIRED_VARS=(
  DATABASE_URL
  REDIS_URL
  JWT_SECRET
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  GEMINI_API_KEY
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  FIREBASE_PROJECT_ID
  FIREBASE_CLIENT_EMAIL
  FIREBASE_PRIVATE_KEY
)

OPTIONAL_VARS=(
  POSTGRES_CRYPTO_KEY
)

missing=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing required env vars: ${missing[*]}" >&2
  exit 1
fi

warnings=()
for var in "${OPTIONAL_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    warnings+=("$var")
  fi
done

if (( ${#warnings[@]} > 0 )); then
  echo "Warning: optional env vars unset -> ${warnings[*]}" >&2
fi

echo "Environment ready."
