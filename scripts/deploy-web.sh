#!/usr/bin/env bash
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI missing. Install via \"npm i -g vercel\"." >&2
  exit 1
fi

PROJECT_PATH=${PROJECT_PATH:-apps/web}
VERCEL_SCOPE=${VERCEL_SCOPE:-humanchat}

vercel pull --yes --environment=production --scope="$VERCEL_SCOPE"
vercel build "$PROJECT_PATH" --prod
vercel deploy --prebuilt --prod --scope="$VERCEL_SCOPE"
