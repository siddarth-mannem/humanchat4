#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Update Cloud Run Environment Variables"
echo "=========================================="

# Environment: 'production' or 'development'
DEPLOY_ENV=${DEPLOY_ENV:-"development"}

PROJECT_ID=${PROJECT_ID:-"loyal-env-475400-u0"}
REGION=${REGION:-"us-central1"}

# Set environment-specific service name
if [[ "${DEPLOY_ENV}" == "development" ]]; then
  SERVICE_NAME=${SERVICE_NAME:-"humanchat-api-dev"}
else
  SERVICE_NAME=${SERVICE_NAME:-"humanchat-api"}
fi

# Check if env vars file is provided
if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <env-vars-file.yaml>"
  echo ""
  echo "Example YAML format:"
  echo "  NODE_ENV: \"development\""
  echo "  CORS_ORIGIN: \"http://localhost:3000,https://app.example.com\""
  echo ""
  exit 1
fi

ENV_FILE="$1"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "❌ File not found: ${ENV_FILE}" >&2
  exit 1
fi

echo ""
echo "📋 Configuration:"
echo "  Project ID: ${PROJECT_ID}"
echo "  Region: ${REGION}"
echo "  Service: ${SERVICE_NAME}"
echo "  Env File: ${ENV_FILE}"
echo ""

echo "🚀 Updating environment variables..."
gcloud run services update "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --env-vars-file="${ENV_FILE}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)')

echo ""
echo "✅ Environment variables updated!"
echo ""
echo "🌐 Service URL: ${SERVICE_URL}"
echo "📊 View logs: gcloud logs read --project=${PROJECT_ID} --filter=\"resource.labels.service_name=${SERVICE_NAME}\""
echo ""
