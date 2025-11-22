# Deployment Guide

This doc complements `docs/environment.md`, `docs/monitoring.md`, and the Terraform under `infra/`.

## Environments
- **Staging**: `staging.humanchat.com`, `api-staging.humanchat.com`, `ws-staging.humanchat.com`
- **Production**: `humanchat.com`, `api.humanchat.com`, `ws.humanchat.com`

## Environment Variables
See `docs/environment.md` for the master list. Provider-specific highlights:
- `VERCEL_TOKEN`, `VERCEL_TEAM`
- `GCP_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS` (service-account JSON for Cloud Run deploys)
- Secret Manager entries: `cloudsql-database-url`, `cloudsql-db-password`
- `CLOUDFLARE_TOKEN`, `CLOUDFLARE_ZONE_ID`
- `UPSTASH_EMAIL`, `UPSTASH_API_KEY`

## CI/CD Pipeline
1. GitHub Actions workflow (to add) runs:
   - Install deps → lint/tests (`npm run test` + `npm run test:api`).
   - Upload coverage.
2. On `main` success:
   - `scripts/deploy-web.sh` → Vercel production deploy.
   - `scripts/deploy-api.sh` (Cloud Run) builds/pushes the Docker image and deploys the HTTP/WebSocket service.
   - `scripts/migrate.sh` (or `npm run db:migrate` in Cloud Shell) runs against Cloud SQL using the same credentials as the Cloud Run service.
3. Notify Slack channel once health checks pass.

## Pre-deploy Checklist
Run these steps locally (or in Cloud Shell) before any manual deploy:

```bash
# 1. Ensure required secrets/env vars are present.
ENV_FILE=.env.cloudrun ./scripts/verify-env.sh

# 2. Sync secrets + run database migrations via the Cloud SQL proxy.
ENV_FILE=.env.cloudrun INSTANCE_CONNECTION="loyal-env-475400-u0:us-central1:users" \
   ./scripts/sync-env.sh
```

`scripts/sync-env.sh` will source the specified env file, validate secrets, start the Cloud SQL Auth Proxy (downloading it if necessary), rewrite the local `DATABASE_URL` to use `127.0.0.1:<LOCAL_DB_PORT>`, and run `npm run db:migrate`. Override `LOCAL_DB_PORT` or `MIGRATE_CMD` if needed.

## Terraform Workflow
```bash
cd infra
terraform init
terraform workspace select staging # or production
terraform plan -var-file=env/staging.tfvars
terraform apply -var-file=env/staging.tfvars
```
Variables file should contain provider tokens and environment-specific URLs. Outputs provide domain + connection strings.

## Manual Deployment (fallback)
```bash
./scripts/verify-env.sh
./scripts/deploy-web.sh
PROJECT_ID=<gcp-project> REGION=us-central1 SERVICE_NAME=humanchat-api \
   CLOUD_SQL_INSTANCES="loyal-env-475400-u0:us-central1:users" \
   SET_SECRETS="DATABASE_URL=cloudsql-database-url:latest,FIREBASE_PROJECT_ID=firebase-project-id:latest,FIREBASE_CLIENT_EMAIL=firebase-client-email:latest,FIREBASE_PRIVATE_KEY=firebase-private-key:latest" \
   ./scripts/deploy-api.sh
```
Use `SET_SECRETS` to mix Cloud SQL (`DATABASE_URL`) with other sensitive values. If you still rely on a static env file for non-secret config, pass `ENV_FILE=.env.cloudrun` alongside the flags above. See `infra/google-cloud/README.md` for details.

## Rollback Procedures
- **Frontend**: `vercel rollback --to <deployment-id>` or select previous build in dashboard.
- **API/WS**: `gcloud run services list` → `gcloud run services update-traffic humanchat-api --to-revisions <rev>=100`.
- **Database**: Restore from the latest Cloud SQL backup (see `docs/backup-restore.md`). Update `DATABASE_URL` secrets, redeploy API.
- **Feature flags**: Toggle via config service (future) or env vars.

## Post-Deploy Verification
1. `curl https://api.humanchat.com/health` returns 200.
2. WebSocket handshake via `wscat -c wss://ws.humanchat.com?token=<jwt>`.
3. Trigger sample booking via staging UI.
4. Ensure Sentry receives deploy marker and no new blocking errors.

## Observability Hooks
- `scripts/deploy-*.sh` should emit logs to CI.
- Better Uptime monitors automatically pause/resume via API (todo).

## Pending Improvements
- Add GitHub Actions workflow file.
- Blue/green deploy for API to avoid downtime during migrations.
- Automated Lighthouse + load testing gates.
