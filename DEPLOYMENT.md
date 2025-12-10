# Deployment Guide

## Architecture Overview

```
Frontend (Vercel)          Backend API (Cloud Run)         Database
─────────────────          ───────────────────────         ────────
Next.js App      ──────>   Express + WebSocket    ──────>  Cloud SQL
humanchat4.vercel.app      humanchat-api.run.app           PostgreSQL
                                    │
                                    └─────────────────────> Redis/Memorystore
```

## Quick Start

1. **Backend API** → [GOOGLE_CLOUD_RUN_DEPLOYMENT.md](./GOOGLE_CLOUD_RUN_DEPLOYMENT.md)
2. **Frontend** → [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

---

## Environments
- **Production Frontend**: `https://humanchat4.vercel.app`
- **Production Backend**: `https://humanchat-api-xxxxx-uc.a.run.app` (Cloud Run)
- **Database**: Cloud SQL `loyal-env-475400-u0:us-central1:users`

## Environment Variables
See `docs/environment.md` for the master list. Provider-specific highlights:
- `VERCEL_TOKEN`, `VERCEL_TEAM`
- `GCP_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS` (service-account JSON for Cloud Run deploys)
- Secret Manager entries: `cloudsql-database-url`, `cloudsql-db-password`
- `CLOUDFLARE_TOKEN`, `CLOUDFLARE_ZONE_ID`
- `UPSTASH_EMAIL`, `UPSTASH_API_KEY`

## Deployment Steps

### 1. Deploy Backend to Google Cloud Run

See [GOOGLE_CLOUD_RUN_DEPLOYMENT.md](./GOOGLE_CLOUD_RUN_DEPLOYMENT.md) for detailed instructions.

**Quick deploy:**
```bash
# Ensure you have the deployment script
chmod +x scripts/deploy-cloud-run.sh

# Deploy backend
./scripts/deploy-cloud-run.sh
```

**Get your Cloud Run URL:**
```bash
gcloud run services describe humanchat-api --region=us-central1 --format="value(status.url)"
```

### 2. Deploy Frontend to Vercel

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for detailed instructions.

**Quick deploy:**
```bash
# Set environment variable in Vercel dashboard
NEXT_PUBLIC_API_URL=https://your-cloud-run-url.run.app
NEXT_PUBLIC_WS_URL=wss://your-cloud-run-url.run.app

# Deploy
vercel --prod
```

### 3. Run Database Migrations

```bash
# Connect via Cloud SQL Proxy
~/bin/cloud-sql-proxy --port 5432 loyal-env-475400-u0:us-central1:users &

# Run migrations
DATABASE_URL='postgresql://postgres:PASSWORD@localhost:5432/postgres' npm run db:migrate
```

---

## CI/CD Pipeline

1. **GitHub Actions** workflow runs:
   - Install deps → lint/tests (`npm run test` + `npm run test:api`)
   - Upload coverage
   
2. On `main` branch success:
   - **Backend**: `scripts/deploy-cloud-run.sh` builds Docker image, pushes to GCR, deploys to Cloud Run
   - **Frontend**: `scripts/deploy-web.sh` deploys to Vercel
   - **Migrations**: Run via Cloud Run Job or Cloud Shell
   
3. Health checks and Slack notification

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

> **Note:** `.env.cloudrun` uses `KEY=VALUE` pairs so the Next.js build step can load public env vars during Docker builds. Use `.env.cloudrun.yaml` (YAML map syntax) with `ENV_FILE=.env.cloudrun.yaml ./scripts/deploy-api.sh` so `gcloud run deploy --env-vars-file` accepts the config.

## Terraform Workflow
```bash
cd infra
terraform init
terraform workspace select staging # or production
terraform plan -var-file=env/staging.tfvars
terraform apply -var-file=env/staging.tfvars
```
Variables file should contain provider tokens and environment-specific URLs. Outputs provide domain + connection strings.

## Manual Deployment

### Backend (Google Cloud Run)

```bash
# Build and deploy
./scripts/deploy-cloud-run.sh

# Or manually
docker build -t gcr.io/loyal-env-475400-u0/humanchat-api:latest .
docker push gcr.io/loyal-env-475400-u0/humanchat-api:latest

gcloud run deploy humanchat-api \
  --image=gcr.io/loyal-env-475400-u0/humanchat-api:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest" \
  --add-cloudsql-instances=loyal-env-475400-u0:us-central1:users
```

### Frontend (Vercel)

```bash
# Deploy to Vercel
vercel --prod

# Or via dashboard at vercel.com
```

### Database Migrations

```bash
# Via Cloud SQL Proxy
~/bin/cloud-sql-proxy --port 5432 loyal-env-475400-u0:us-central1:users &
DATABASE_URL='postgresql://postgres:PASSWORD@localhost:5432/postgres' npm run db:migrate

# Or via Cloud Run Job
gcloud run jobs execute humanchat-migrate --region=us-central1
```

## Rollback Procedures

### Frontend (Vercel)
```bash
# Via CLI
vercel rollback --to <deployment-id>

# Or via Vercel Dashboard → Deployments → Select previous → Promote
```

### Backend (Cloud Run)
```bash
# List revisions
gcloud run revisions list --service=humanchat-api --region=us-central1

# Rollback to specific revision
gcloud run services update-traffic humanchat-api \
  --region=us-central1 \
  --to-revisions=humanchat-api-00001-abc=100
```

### Database
- Restore from Cloud SQL backup (see `docs/backup-restore.md`)
- Update `DATABASE_URL` secret
- Redeploy API to pick up new connection

## Post-Deploy Verification

### Backend Health Check
```bash
# Get Cloud Run URL
export API_URL=$(gcloud run services describe humanchat-api --region=us-central1 --format="value(status.url)")

# Health check
curl $API_URL/health

# Should return: {"status":"ok"}
```

### Frontend Check
```bash
# Visit
open https://humanchat4.vercel.app

# Test login flow
# Test chat with Sam
# Test video session booking
```

### WebSocket Check
```bash
# Install wscat if needed
npm install -g wscat

# Test WebSocket connection
wscat -c "wss://your-cloud-run-url.run.app?token=<jwt>"
```

### Database Connection
```bash
# View Cloud Run logs
gcloud run services logs read humanchat-api --region=us-central1 --limit=50

# Check for database connection errors
gcloud run services logs read humanchat-api --region=us-central1 | grep -i "postgres\|database"
```

## Observability Hooks
- `scripts/deploy-*.sh` should emit logs to CI.
- Better Uptime monitors automatically pause/resume via API (todo).

## Monitoring & Logs

### Cloud Run Logs
```bash
# View recent logs
gcloud run services logs read humanchat-api --region=us-central1 --limit=100

# Stream live logs
gcloud run services logs tail humanchat-api --region=us-central1

# Filter by severity
gcloud run services logs read humanchat-api --region=us-central1 --log-filter="severity>=ERROR"
```

### Vercel Logs
```bash
# Via CLI
vercel logs humanchat4

# Or via Vercel Dashboard → Logs
```

### Cloud SQL Monitoring
```bash
# View database metrics in Google Cloud Console
# Navigate to: Cloud SQL → loyal-env-475400-u0 → Monitoring
```

---

## Cost Estimate

### Google Cloud Run
- **Free Tier**: 2M requests/month, 360k GB-seconds
- **Beyond Free**: ~$0.40 per million requests
- **Estimated**: $5-20/month with moderate traffic

### Cloud SQL
- **Current Setup**: Already running
- Check billing in Google Cloud Console

### Redis/Memorystore
- **Memorystore**: ~$50/month for 1GB basic tier
- **Upstash (Serverless)**: Pay per request, ~$5-10/month

### Vercel
- **Hobby Plan**: Free for personal projects
- **Pro Plan**: $20/month if needed

### Total Estimated Monthly Cost
- **Development**: ~$10-20/month
- **Production**: ~$50-100/month

---

## Troubleshooting

### Backend Issues

**Build fails:**
```bash
# Check Docker build locally
docker build -t test .

# View build logs
gcloud builds log --region=us-central1
```

**Deployment fails:**
```bash
# Check service account permissions
gcloud projects get-iam-policy loyal-env-475400-u0

# Verify secrets exist
gcloud secrets list
```

**App crashes:**
```bash
# View detailed logs
gcloud run services logs read humanchat-api --region=us-central1

# Check resource usage
gcloud run services describe humanchat-api --region=us-central1
```

**Database connection fails:**
```bash
# Verify Cloud SQL connection
gcloud sql instances describe users --project=loyal-env-475400-u0

# Check DATABASE_URL secret
gcloud secrets versions access latest --secret=DATABASE_URL
```

### Frontend Issues

**Build fails in Vercel:**
- Check build logs in Vercel dashboard
- Verify environment variables are set
- Check Next.js configuration

**API calls fail:**
- Verify `NEXT_PUBLIC_API_URL` in Vercel env vars
- Check CORS settings in backend
- Test API endpoint directly

---

## Security Checklist

- [ ] All secrets in Google Secret Manager (not in code)
- [ ] Cloud Run service uses least-privilege service account
- [ ] CORS configured to allow only Vercel domain
- [ ] Cloud SQL not publicly accessible
- [ ] Redis/Memorystore on private network
- [ ] Google OAuth redirect URIs restricted
- [ ] Rate limiting enabled on API
- [ ] SSL/TLS enforced (Cloud Run default)
- [ ] Environment variables validated
- [ ] Secrets rotated regularly

---

## Related Documentation

- [GOOGLE_CLOUD_RUN_DEPLOYMENT.md](./GOOGLE_CLOUD_RUN_DEPLOYMENT.md) - Detailed Cloud Run setup
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Frontend deployment guide
- [DATABASE_SCHEMA_DIAGRAM.md](./DATABASE_SCHEMA_DIAGRAM.md) - Database structure
- [docs/environment.md](./docs/environment.md) - Environment variables reference
- [docs/monitoring.md](./docs/monitoring.md) - Monitoring setup
