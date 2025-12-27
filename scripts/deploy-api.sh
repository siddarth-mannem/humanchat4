#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME=${SERVICE_NAME:-humanchat-api}
SCRIPT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)

# Ensure Cloud Run always receives the full set of secrets even if the caller forgets
# to pass SET_SECRETS. Appending to a user-supplied list keeps manual overrides intact
# while preventing accidental omissions (e.g. GEMINI_API_KEY).
DEFAULT_SECRET_MAP="DATABASE_URL=neon-database-url:latest,FIREBASE_PROJECT_ID=firebase-project-id:latest,FIREBASE_CLIENT_EMAIL=firebase-client-email:latest,FIREBASE_PRIVATE_KEY=firebase-private-key:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"
if [[ -z "${SET_SECRETS:-}" ]]; then
	export SET_SECRETS="${DEFAULT_SECRET_MAP}"
elif [[ "${SET_SECRETS}" != *"GEMINI_API_KEY="* ]]; then
	export SET_SECRETS="${SET_SECRETS},GEMINI_API_KEY=GEMINI_API_KEY:latest"
fi

SERVICE_NAME="$SERVICE_NAME" "${SCRIPT_DIR}/deploy-cloud-run.sh" "$@"
