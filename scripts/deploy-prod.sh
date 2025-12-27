#!/usr/bin/env bash
set -euo pipefail

export PROJECT_ID=loyal-env-475400-u0
exec "$(dirname "$0")/deploy-api.sh" "$@"
