#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME=${SERVICE_NAME:-humanchat-ws}
SCRIPT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)

SERVICE_NAME="$SERVICE_NAME" "${SCRIPT_DIR}/deploy-cloud-run.sh" "$@"
