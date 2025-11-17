#!/usr/bin/env bash
set -euo pipefail

REQUIRED_VARS=(
  DATABASE_URL
  REDIS_URL
  JWT_SECRET
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  GEMINI_API_KEY
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
)

missing=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing env vars: ${missing[*]}" >&2
  exit 1
fi

echo "Environment ready."
