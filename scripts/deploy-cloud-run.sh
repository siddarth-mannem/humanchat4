#!/usr/bin/env bash
set -euo pipefail

echo "🚀 HumanChat Backend Deployment to Google Cloud Run"
echo "=================================================="

if ! command -v gcloud >/dev/null 2>&1; then
  echo "❌ gcloud CLI missing. Install via https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop." >&2
  exit 1
fi

# Environment: 'production' or 'development'
DEPLOY_ENV=${DEPLOY_ENV:-"production"}

PROJECT_ID=${PROJECT_ID:-"loyal-env-475400-u0"}
REGION=${REGION:-"us-central1"}
PORT=${PORT:-8080}
SKIP_BUILD=${SKIP_BUILD:-0}
CLOUD_SQL_INSTANCES=${CLOUD_SQL_INSTANCES:-"loyal-env-475400-u0:us-central1:users"}

# Set environment-specific configurations
# command: DEPLOY_ENV=development ./scripts/deploy-cloud-run.sh env-dev-cloudrun.yaml
if [[ "${DEPLOY_ENV}" == "development" ]]; then
  SERVICE_NAME=${SERVICE_NAME:-"humanchat-api-dev"}
  NODE_ENV="development"
  MIN_INSTANCES=0
  MAX_INSTANCES=3
  MEMORY="512Mi"
  SECRET_SUFFIX="_DEV"
  CORS_ORIGIN="http://localhost:3000,https://humanchat4.vercel.app,https://humanchat4-git-develop-sids-projects-2126eccc.vercel.app,https://humanchat4-j72fdss8d-sids-projects-2126eccc.vercel.app"
  API_BASE_URL="https://humanchat-api-dev-37305898543.us-central1.run.app"
  APP_URL="https://humanchat4.vercel.app"
else # command: DEPLOY_ENV=production ./scripts/deploy-cloud-run.sh env-prod-cloudrun.yaml
  SERVICE_NAME=${SERVICE_NAME:-"humanchat-api"}
  NODE_ENV="production"
  MIN_INSTANCES=0
  MAX_INSTANCES=10
  MEMORY="1Gi"
  SECRET_SUFFIX=""
  CORS_ORIGIN="https://humanchat.com"
  API_BASE_URL="https://api.humanchat.com"
  APP_URL="https://humanchat.com"
fi

IMAGE_TAG=${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}

# Use Container Registry (simpler than Artifact Registry)
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${IMAGE_TAG}"

echo ""
echo "📋 Configuration:"
echo "  Environment: ${DEPLOY_ENV}"
echo "  Project ID: ${PROJECT_ID}"
echo "  Region: ${REGION}"
echo "  Service: ${SERVICE_NAME}"
echo "  Node ENV: ${NODE_ENV}"
echo "  Image: ${IMAGE}"
echo ""

if [[ "${SKIP_BUILD}" != "1" ]]; then
  echo "🔨 Building Docker image for linux/amd64..."
  docker build --platform linux/amd64 -t "${IMAGE}" .
  
  echo "📤 Pushing image to Container Registry..."
  docker push "${IMAGE}"
else
  echo "⏭️  Skipping build (SKIP_BUILD=1)"
fi

echo ""
echo "🚢 Deploying to Cloud Run (${DEPLOY_ENV})..."
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --platform managed \
  --port "${PORT}" \
  --allow-unauthenticated \
  --add-cloudsql-instances "${CLOUD_SQL_INSTANCES}" \
  --set-secrets "DATABASE_URL=DATABASE_URL${SECRET_SUFFIX}:latest,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID${SECRET_SUFFIX}:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL${SECRET_SUFFIX}:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY${SECRET_SUFFIX}:latest,GEMINI_API_KEY=GEMINI_API_KEY${SECRET_SUFFIX}:latest,REDIS_URL=REDIS_URL${SECRET_SUFFIX}:latest,CORTEX_API_TOKEN=CORTEX_API_TOKEN${SECRET_SUFFIX}:latest" \
  --memory "${MEMORY}" \
  --cpu 1 \
  --min-instances "${MIN_INSTANCES}" \
  --max-instances "${MAX_INSTANCES}" \
  --timeout 300 \
  --set-env-vars "NODE_ENV=${NODE_ENV},DEPLOY_ENV=${DEPLOY_ENV},CORS_ORIGIN='${CORS_ORIGIN}',API_BASE_URL=${API_BASE_URL},APP_URL=${APP_URL}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Service URL: ${SERVICE_URL}"
echo "📊 View logs: gcloud logs read --project=${PROJECT_ID} --filter=\"resource.labels.service_name=${SERVICE_NAME}\""
echo ""
echo "Next steps:"
echo "1. Test health endpoint: curl ${SERVICE_URL}/health"
echo "2. Update Vercel with NEXT_PUBLIC_API_URL=${SERVICE_URL}"
echo "3. Update Vercel with NEXT_PUBLIC_WS_URL=${SERVICE_URL}"
