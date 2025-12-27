# Google Cloud Deployment (Cloud Run)

This guide replaces the old Railway process and covers how to build, publish, and run the HumanChat backend (API + WebSocket) on Google Cloud Run.

Terraform now provisions the Cloud Run services as well. Set `gcp_project_id`, `gcp_region`, `api_image`, and `ws_image` in your tfvars, then run `terraform apply` from the `infra/` directory. The `modules/cloud-run-service` module creates the service, applies env vars, and exposes the default run.app hostname for DNS wiring.

## Prerequisites
1. **Google Cloud project** with billing enabled.
2. `gcloud` CLI installed and authenticated (`gcloud auth login`).
3. Enable required services:
   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project <project-id>
   ```
4. Create an Artifact Registry repository once (skip if it already exists):
   ```bash
   gcloud artifacts repositories create humanchat \
     --repository-format=docker \
     --location=us --project <project-id>
   ```
5. Service account with `Artifact Registry Admin`, `Cloud Run Admin`, and `Cloud Build Editor` roles (or broader during bootstrap). Export its JSON key if using CI.

## Container Build
The repo now includes a production-ready `Dockerfile` and `.dockerignore`. The image builds the TypeScript server (skipping the Next.js web bundle via `SKIP_WEB_BUILD=1`) and starts the compiled API with `node dist/src/server/index.js`.

To build/push manually:
```bash
PROJECT_ID=<project-id>
REGION=us-central1
SERVICE_NAME=humanchat-api
IMAGE=us-docker.pkg.dev/$PROJECT_ID/humanchat/$SERVICE_NAME:$(git rev-parse --short HEAD)

gcloud builds submit --project "$PROJECT_ID" --tag "$IMAGE" .
```

## Deployment Script
Use `scripts/deploy-cloud-run.sh` directly or via the wrappers (`scripts/deploy-api.sh`, `scripts/deploy-ws.sh`). The helper accepts several environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `PROJECT_ID` | Target GCP project **(required)** | — |
| `REGION` | Cloud Run region | `us-central1` |
| `SERVICE_NAME` | Cloud Run service name | `humanchat-api` |
| `REPOSITORY` | Artifact Registry repo | `humanchat` |
| `IMAGE_TAG` | Container tag | `git rev-parse --short HEAD` |
| `ENV_FILE` | Path to env vars file passed to `--env-vars-file` | *(unset)* |
| `MIN_INSTANCES`/`MAX_INSTANCES` | Autoscaling bounds | *(unset)* |
| `CPU`, `MEMORY`, `CONCURRENCY` | Resource tuning | *(unset)* |
| `VPC_CONNECTOR`, `VPC_EGRESS` | Optional Serverless VPC access | *(unset)* |

Example deploy:
```bash
cat > .env.cloudrun <<'ENV'
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://neondb_owner:<password>@ep-example-pooler.us-east-1.aws.neon.tech/main?sslmode=require&channel_binding=require
REDIS_URL=redis://...upstash...
JWT_SECRET=...
JWT_EXPIRES_IN=12h
FIREBASE_PROJECT_ID=humanchat-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@humanchat-prod.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://api.humanchat.com/api/auth/google/callback
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
CORS_ORIGINS=https://humanchat.com,https://humanchat-git-*.vercel.app
NEXT_PUBLIC_API_URL=https://api.humanchat.com
NEXT_PUBLIC_WS_URL=wss://api.humanchat.com
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=humanchat-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=humanchat-prod
NODE_OPTIONS=--dns-result-order=ipv4first
ENV

PROJECT_ID=<project-id> REGION=us-central1 SERVICE_NAME=humanchat-api \
  ENV_FILE=.env.cloudrun ./scripts/deploy-api.sh
```
> ⚠️ Keep `.env.cloudrun` out of version control (already ignored). Use Secret Manager for production if possible and pass secrets via `--set-secrets` instead of `--env-vars-file`.

## Traffic, Domains & TLS
- Cloud Run gives you a default `https://<service>-<hash>-<region>.run.app` URL.
- Map `api.humanchat.com` via Cloud Run domain mappings or Cloudflare → Google load balancer.
- WebSockets are supported automatically; no extra flags needed.

## Post-Deploy Verification
1. `curl https://api.humanchat.com/health` → `200 OK`.
2. WebSocket probe: `wscat -c "wss://api.humanchat.com?token=<jwt>"`.
3. Check Cloud Run logs (`gcloud run services logs read humanchat-api --region us-central1`).
4. Ensure `NODE_OPTIONS env: --dns-result-order=ipv4first` appears once per revision to confirm config injection.

## Rollbacks & Cleanup
- List revisions: `gcloud run revisions list --service humanchat-api --region us-central1`.
- Roll back: `gcloud run services update-traffic humanchat-api --to-revisions <rev>=100 --region us-central1`.
- Delete unused images: `gcloud artifacts docker images delete us-docker.pkg.dev/$PROJECT_ID/humanchat/humanchat-api@sha256:<digest>`.

## Next Steps
- Wire the deploy script into GitHub Actions using a workload identity provider.
- Move sensitive env vars into Secret Manager and reference them via `--set-secrets` in the deploy command.
- Consider a dedicated VPC connector if outbound traffic must originate from fixed IPs.
