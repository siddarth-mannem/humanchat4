#!/usr/bin/env bash
set -euo pipefail

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI missing. Install via https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

PROJECT_ID=${PROJECT_ID:?"Set PROJECT_ID to the target Google Cloud project."}
REGION=${REGION:-us-central1}
SERVICE_NAME=${SERVICE_NAME:-humanchat-api}
REPOSITORY=${REPOSITORY:-humanchat}
IMAGE_TAG=${IMAGE_TAG:-$(git rev-parse --short HEAD)}
PLATFORM=${PLATFORM:-managed}
PORT=${PORT:-8080}
SKIP_BUILD=${SKIP_BUILD:-0}
ENV_FILE=${ENV_FILE:-}
VPC_CONNECTOR=${VPC_CONNECTOR:-}
VPC_EGRESS=${VPC_EGRESS:-}
MIN_INSTANCES=${MIN_INSTANCES:-}
MAX_INSTANCES=${MAX_INSTANCES:-}
CPU=${CPU:-}
MEMORY=${MEMORY:-}
CONCURRENCY=${CONCURRENCY:-}

IMAGE="us-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:${IMAGE_TAG}"

if [[ "${SKIP_BUILD}" != "1" ]]; then
  echo "Building and pushing image ${IMAGE}"
  gcloud builds submit --project "${PROJECT_ID}" --tag "${IMAGE}" .
fi

deploy_cmd=(
  gcloud run deploy "${SERVICE_NAME}"
  --project "${PROJECT_ID}"
  --region "${REGION}"
  --platform "${PLATFORM}"
  --image "${IMAGE}"
  --allow-unauthenticated
  --port "${PORT}"
)

if [[ -n "${ENV_FILE}" ]]; then
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ENV_FILE ${ENV_FILE} not found" >&2
    exit 1
  fi
  deploy_cmd+=(--env-vars-file "${ENV_FILE}")
fi

if [[ -n "${VPC_CONNECTOR}" ]]; then
  deploy_cmd+=(--vpc-connector "${VPC_CONNECTOR}")
  if [[ -n "${VPC_EGRESS}" ]]; then
    deploy_cmd+=(--vpc-egress "${VPC_EGRESS}")
  fi
fi

if [[ -n "${MIN_INSTANCES}" ]]; then
  deploy_cmd+=(--min-instances "${MIN_INSTANCES}")
fi
if [[ -n "${MAX_INSTANCES}" ]]; then
  deploy_cmd+=(--max-instances "${MAX_INSTANCES}")
fi
if [[ -n "${CPU}" ]]; then
  deploy_cmd+=(--cpu "${CPU}")
fi
if [[ -n "${MEMORY}" ]]; then
  deploy_cmd+=(--memory "${MEMORY}")
fi
if [[ -n "${CONCURRENCY}" ]]; then
  deploy_cmd+=(--concurrency "${CONCURRENCY}")
fi

printf 'Deploying Cloud Run service %s\n' "${SERVICE_NAME}"
"${deploy_cmd[@]}"
