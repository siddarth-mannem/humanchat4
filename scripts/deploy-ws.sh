#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME=${SERVICE_NAME:-ws}
ENVIRONMENT=${ENVIRONMENT:-production}

if ! command -v railway >/dev/null 2>&1; then
  echo "railway CLI missing. Install via \"npm i -g @railway/cli\"." >&2
  exit 1
fi

railway up --service "$SERVICE_NAME" --environment "$ENVIRONMENT" --build
railway variables set --service "$SERVICE_NAME" --environment "$ENVIRONMENT" WS_HEALTHCHECK="/health"
