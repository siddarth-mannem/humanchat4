# Google Cloud Run Backend Deployment Guide

## Prerequisites

1. **Google Cloud SDK** installed
2. **Docker** installed
3. **Google Cloud Project** with billing enabled
4. **Cloud SQL** instance already set up (you have: `YOUR_GCP_PROJECT_ID:us-central1:users`)
5. **Artifact Registry** or **Container Registry** enabled

---

## Step-by-Step Deployment

### 1. Install Google Cloud SDK (if not installed)

```bash
# macOS
brew install google-cloud-sdk

# Or download from https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate with Google Cloud

```bash
# Login
gcloud auth login

# Set your project
gcloud config set project YOUR_GCP_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### 3. Create Dockerfile for Backend

Create `Dockerfile` in project root:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json tsconfig.build.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src
COPY scripts ./scripts

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Cloud Run sets PORT automatically
EXPOSE 8080

CMD ["node", "dist/src/server/index.js"]
```

### 4. Create .dockerignore

Create `.dockerignore` in project root:

```
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
README.md
apps/web
dist
.next
coverage
*.md
docs
infra
tests
e2e
scripts/*.sh
```

### 5. Update Server to Use PORT from Cloud Run

Cloud Run sets PORT environment variable. Update `src/server/config/env.ts`:

```typescript
export const env = {
  port: parseInt(process.env.PORT || process.env.API_PORT || '4000', 10),
  // ... rest of config
};
```

### 6. Configure Secrets in Google Secret Manager

```bash
# Create secrets
echo -n "your-database-url" | gcloud secrets create DATABASE_URL --data-file=-
echo -n "your-jwt-secret" | gcloud secrets create JWT_SECRET --data-file=-
echo -n "YOUR_GOOGLE_CLIENT_SECRET" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-

# For multiline secrets like Firebase private key
cat <<'EOF' | gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=-
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDhH9tLtU7YKToQ
...
-----END PRIVATE KEY-----
EOF

# Or create from file
gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=firebase-key.json
```

### 7. Build and Push Docker Image

```bash
# Set variables
export PROJECT_ID=YOUR_GCP_PROJECT_ID
export REGION=us-central1
export SERVICE_NAME=humanchat-api
export IMAGE_NAME=gcr.io/$PROJECT_ID/$SERVICE_NAME

# Build the image
docker build -t $IMAGE_NAME:latest .

# Test locally (optional)
docker run -p 8080:8080 --env-file .env $IMAGE_NAME:latest

# Push to Google Container Registry
docker push $IMAGE_NAME:latest
```

### 8. Deploy to Cloud Run

```bash
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE_NAME:latest \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --max-instances=10 \
  --min-instances=0 \
  --set-env-vars="NODE_ENV=production,CORS_ORIGIN=https://humanchat4.vercel.app,GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_PREFIX-0rdld5mq1u7a4f2f33u6ku4g5ij77umr.apps.googleusercontent.com,FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT,FIREBASE_CLIENT_EMAIL=humanchat-firebase-admin@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com,GEMINI_MODEL=gemini-2.5-flash,JWT_EXPIRES_IN=12h" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest" \
  --add-cloudsql-instances=YOUR_GCP_PROJECT_ID:us-central1:users \
  --vpc-connector=projects/$PROJECT_ID/locations/$REGION/connectors/YOUR_VPC_CONNECTOR
```

**Note:** If you don't have a VPC connector, Cloud Run can connect to Cloud SQL using the `--add-cloudsql-instances` flag directly.

### 9. Get the Deployed URL

```bash
# Get service URL
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"
```

Example output: `https://humanchat-api-xxxxx-uc.a.run.app`

### 10. Update Environment Variables

Update your backend's `DATABASE_URL` secret for Cloud Run:

```bash
# For Cloud Run, use Unix socket connection
echo -n "postgresql://postgres:PASSWORD@/postgres?host=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:users" | \
  gcloud secrets versions add DATABASE_URL --data-file=-
```

### 11. Run Database Migrations

```bash
# Option 1: Run migrations from Cloud Shell
gcloud cloud-shell ssh

# In Cloud Shell
git clone https://github.com/siddarth-mannem/humanchat4
cd humanchat4
npm install
DATABASE_URL='postgresql://postgres:PASSWORD@/postgres?host=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:users' npm run db:migrate

# Option 2: Create a Cloud Run Job for migrations
gcloud run jobs create humanchat-migrate \
  --image=$IMAGE_NAME:latest \
  --region=$REGION \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --add-cloudsql-instances=YOUR_GCP_PROJECT_ID:us-central1:users \
  --command="npm" \
  --args="run,db:migrate"

# Execute migration job
gcloud run jobs execute humanchat-migrate --region=$REGION
```

### 12. Configure Redis (Memorystore or Upstash)

#### Option A: Google Memorystore Redis

```bash
# Create Redis instance
gcloud redis instances create humanchat-redis \
  --size=1 \
  --region=$REGION \
  --redis-version=redis_7_0

# Get the host
gcloud redis instances describe humanchat-redis --region=$REGION

# Add REDIS_URL to secrets
echo -n "redis://HOST:6379" | gcloud secrets create REDIS_URL --data-file=-
```

#### Option B: Upstash Redis (Serverless)

1. Go to [upstash.com](https://upstash.com)
2. Create Redis database
3. Copy the Redis URL
4. Add to Secret Manager:

```bash
echo -n "your-upstash-redis-url" | gcloud secrets create REDIS_URL --data-file=-
```

Then redeploy with the new secret:

```bash
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --update-secrets=REDIS_URL=REDIS_URL:latest
```

### 13. Update Vercel Environment Variables

In Vercel dashboard, set:

```env
NEXT_PUBLIC_API_URL=https://humanchat-api-xxxxx-uc.a.run.app
NEXT_PUBLIC_WS_URL=wss://humanchat-api-xxxxx-uc.a.run.app
```

### 14. Update Google OAuth Redirect URIs

Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials):

Add:
- **Authorized JavaScript origins:** `https://humanchat-api-xxxxx-uc.a.run.app`
- **Authorized redirect URIs:** `https://humanchat-api-xxxxx-uc.a.run.app/api/auth/google/callback`

### 15. Test the Deployment

```bash
# Health check
curl https://humanchat-api-xxxxx-uc.a.run.app/health

# View logs
gcloud run services logs read $SERVICE_NAME --region=$REGION --limit=50

# Stream logs
gcloud run services logs tail $SERVICE_NAME --region=$REGION
```

---

## Automated Deployment Script

Create `scripts/deploy-cloud-run.sh`:

```bash
#!/bin/bash
set -e

PROJECT_ID=${PROJECT_ID:-"YOUR_GCP_PROJECT_ID"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"humanchat-api"}
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🔨 Building Docker image..."
docker build -t $IMAGE_NAME:latest .

echo "📤 Pushing to Container Registry..."
docker push $IMAGE_NAME:latest

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE_NAME:latest \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --max-instances=10 \
  --min-instances=0 \
  --set-env-vars="NODE_ENV=production,CORS_ORIGIN=https://humanchat4.vercel.app,GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_PREFIX-0rdld5mq1u7a4f2f33u6ku4g5ij77umr.apps.googleusercontent.com,FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT,FIREBASE_CLIENT_EMAIL=humanchat-firebase-admin@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com,GEMINI_MODEL=gemini-2.5-flash,JWT_EXPIRES_IN=12h" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,REDIS_URL=REDIS_URL:latest" \
  --add-cloudsql-instances=YOUR_GCP_PROJECT_ID:us-central1:users

echo "✅ Deployment complete!"
echo "🔗 Service URL:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"
```

Make it executable:

```bash
chmod +x scripts/deploy-cloud-run.sh
```

Run it:

```bash
./scripts/deploy-cloud-run.sh
```

---

## Cost Optimization

Cloud Run pricing (per month):
- **Always Free Tier:** 2 million requests, 360,000 GB-seconds memory, 180,000 vCPU-seconds
- **Beyond Free Tier:** ~$0.40 per million requests + compute time

With `--min-instances=0`, you only pay when handling requests.

For production, consider `--min-instances=1` to keep one instance warm (faster cold starts).

---

## Monitoring & Logs

```bash
# View logs
gcloud run services logs read $SERVICE_NAME --region=$REGION

# Stream logs
gcloud run services logs tail $SERVICE_NAME --region=$REGION

# View metrics
gcloud run services describe $SERVICE_NAME --region=$REGION
```

Set up Cloud Monitoring alerts in Google Cloud Console.

---

## Troubleshooting

### Build fails
- Check Dockerfile syntax
- Ensure `dist` directory is created in build stage
- Verify all dependencies in package.json

### Deployment fails
- Check service account permissions
- Verify secrets exist in Secret Manager
- Check Cloud SQL instance name is correct

### App crashes on startup
- View logs: `gcloud run services logs read $SERVICE_NAME`
- Check environment variables
- Verify database connection string

### Can't connect to Cloud SQL
- Verify `--add-cloudsql-instances` flag
- Check database connection string format for Unix sockets
- Ensure Cloud SQL Admin API is enabled

---

## Production Checklist

- [ ] Secrets configured in Secret Manager
- [ ] Docker image builds successfully
- [ ] Database migrations run
- [ ] Redis/Memorystore configured
- [ ] CORS origin set to Vercel URL
- [ ] Google OAuth redirect URIs updated
- [ ] Health endpoint returns 200
- [ ] Logs show no errors
- [ ] Vercel frontend updated with Cloud Run URL
- [ ] Test authentication flow
- [ ] Test WebSocket connections
- [ ] Set up monitoring/alerts

---

## Rollback

```bash
# List revisions
gcloud run revisions list --service=$SERVICE_NAME --region=$REGION

# Rollback to previous revision
gcloud run services update-traffic $SERVICE_NAME \
  --region=$REGION \
  --to-revisions=REVISION_NAME=100
```
