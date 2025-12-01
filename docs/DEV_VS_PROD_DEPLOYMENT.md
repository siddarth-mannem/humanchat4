# 🔄 Development vs Production Deployment Guide

This guide explains how to deploy HumanChat backend to **separate development and production environments** on Google Cloud Run.

## 📋 Environment Setup

### Two Separate Environments

| Aspect | Development | Production |
|--------|-------------|------------|
| **Service Name** | `humanchat-api-dev` | `humanchat-api` |
| **NODE_ENV** | `development` | `production` |
| **Secrets Suffix** | `_DEV` | (none) |
| **Memory** | 512Mi | 1Gi |
| **Max Instances** | 3 | 10 |
| **Database** | Same Cloud SQL | Same Cloud SQL |
| **Redis** | Separate Upstash DB | Separate Upstash DB |

---

## 🔐 Secret Manager Configuration

Secrets are stored with environment-specific suffixes:

### Development Secrets
- `DATABASE_URL_DEV`
- `FIREBASE_PROJECT_ID_DEV`
- `FIREBASE_CLIENT_EMAIL_DEV`
- `FIREBASE_PRIVATE_KEY_DEV`
- `GEMINI_API_KEY_DEV`
- `REDIS_URL_DEV`

### Production Secrets
- `DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `GEMINI_API_KEY`
- `REDIS_URL`

---

## 🚀 Deployment Steps

### 1. Setup Development Secrets

Create `.env.development` with your development configuration:

```bash
# .env.development (for development)
DATABASE_URL=postgresql://user:pass@/dbname?host=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:users
FIREBASE_PROJECT_ID=YOUR_GCP_PROJECT_ID
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
REDIS_URL=rediss://default:xxxxx@us1-xxxxx-dev.upstash.io:xxxxx
```

Upload to Secret Manager:
```bash
DEPLOY_ENV=development ./scripts/setup-secrets.sh
```

### 2. Setup Production Secrets

Create `.env.production` with your production configuration:

```bash
# .env.production (for production)
DATABASE_URL=postgresql://user:pass@/dbname?host=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:users
FIREBASE_PROJECT_ID=YOUR_GCP_PROJECT_ID
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
REDIS_URL=rediss://default:xxxxx@us1-xxxxx-prod.upstash.io:xxxxx
```

Upload to Secret Manager:
```bash
DEPLOY_ENV=production ./scripts/setup-secrets.sh
```

### 3. Deploy to Development

```bash
DEPLOY_ENV=development ./scripts/deploy-cloud-run.sh
```

**Output will include:**
```
🌐 Service URL: https://humanchat-api-dev-xxxxx-uc.a.run.app
```

### 4. Deploy to Production

```bash
DEPLOY_ENV=production ./scripts/deploy-cloud-run.sh
# or simply:
./scripts/deploy-cloud-run.sh
```

**Output will include:**
```
🌐 Service URL: https://humanchat-api-xxxxx-uc.a.run.app
```

---

## 🌐 Vercel Configuration

### Development Vercel Project

Environment variables for your **development** Vercel deployment:

```bash
# Vercel Environment: Preview or Development
NODE_ENV=development
NEXT_PUBLIC_API_URL=https://humanchat-api-dev-xxxxx-uc.a.run.app
NEXT_PUBLIC_WS_URL=wss://humanchat-api-dev-xxxxx-uc.a.run.app

# Firebase (same for all environments)
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_GEMINI_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_GCP_PROJECT_ID.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_GCP_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_GCP_PROJECT_ID.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_GOOGLE_CLIENT_ID_PREFIX
NEXT_PUBLIC_FIREBASE_APP_ID=1:YOUR_GOOGLE_CLIENT_ID_PREFIX:web:fc6c45f13f0a1ca9c0fa78

# Google OAuth (same for all environments)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_PREFIX-0rdld5mq1u7a4f2f33u6ku4g5ij77umr.apps.googleusercontent.com
```

### Production Vercel Project

Environment variables for your **production** Vercel deployment:

```bash
# Vercel Environment: Production
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://humanchat-api-xxxxx-uc.a.run.app
NEXT_PUBLIC_WS_URL=wss://humanchat-api-xxxxx-uc.a.run.app

# Firebase (same as above)
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_GEMINI_API_KEY
# ... rest of Firebase config ...

# Google OAuth (same as above)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_PREFIX-0rdld5mq1u7a4f2f33u6ku4g5ij77umr.apps.googleusercontent.com
```

---

## 📊 Redis Setup (Upstash)

### Create Two Separate Redis Databases

1. Go to https://console.upstash.com/
2. Create **Development Database**:
   - Name: `humanchat-dev`
   - Region: `us-central1` (closest to Cloud Run)
   - Copy connection string to `.env.local` as `REDIS_URL`

3. Create **Production Database**:
   - Name: `humanchat-prod`
   - Region: `us-central1`
   - Copy connection string to `.env.production` as `REDIS_URL`

---

## 🔄 Quick Reference Commands

### View All Services
```bash
gcloud run services list --project=YOUR_GCP_PROJECT_ID --region=us-central1
```

### View All Secrets
```bash
# Development secrets
gcloud secrets list --project=YOUR_GCP_PROJECT_ID --filter="name:_DEV"

# Production secrets
gcloud secrets list --project=YOUR_GCP_PROJECT_ID --filter="-name:_DEV"
```

### View Logs
```bash
# Development logs
gcloud logs tail --filter="resource.labels.service_name=humanchat-api-dev"

# Production logs
gcloud logs tail --filter="resource.labels.service_name=humanchat-api"
```

### Test Health Endpoints
```bash
# Development
curl https://humanchat-api-dev-xxxxx-uc.a.run.app/health

# Production
curl https://humanchat-api-xxxxx-uc.a.run.app/health
```

---

## 🔧 Environment-Specific Settings

### Development Environment
```bash
# Deployment command
DEPLOY_ENV=development ./scripts/deploy-cloud-run.sh

# What gets deployed:
# - Service: humanchat-api-dev
# - NODE_ENV: development
# - Memory: 512Mi (smaller, cheaper)
# - Max instances: 3 (cost control)
# - Secrets: *_DEV suffix
```

### Production Environment
```bash
# Deployment command
DEPLOY_ENV=production ./scripts/deploy-cloud-run.sh
# or simply:
./scripts/deploy-cloud-run.sh

# What gets deployed:
# - Service: humanchat-api
# - NODE_ENV: production
# - Memory: 1Gi (more resources)
# - Max instances: 10 (can handle traffic)
# - Secrets: no suffix
```

---

## 🛠️ Workflow Examples

### Typical Development Workflow

1. **Make code changes locally**
2. **Test locally** with Cloud SQL proxy
   ```bash
   npm run dev
   ```
3. **Deploy to development**
   ```bash
   DEPLOY_ENV=development ./scripts/deploy-cloud-run.sh
   ```
4. **Test on development URL**
   ```bash
   curl https://humanchat-api-dev-xxxxx-uc.a.run.app/health
   ```
5. **When ready, deploy to production**
   ```bash
   ./scripts/deploy-cloud-run.sh
   ```

### Update Only Secrets (No Code Changes)

```bash
# Update development secrets
DEPLOY_ENV=development ./scripts/setup-secrets.sh
DEPLOY_ENV=development SKIP_BUILD=1 ./scripts/deploy-cloud-run.sh

# Update production secrets
./scripts/setup-secrets.sh
SKIP_BUILD=1 ./scripts/deploy-cloud-run.sh
```

---

## 💰 Cost Comparison

### Development Environment
- Cloud Run: $2-5/month (lower resources, less traffic)
- Redis (Upstash): Free tier
- **Cost savings: ~$15-18/month vs production**

### Production Environment
- Cloud Run: $10-20/month (more resources, traffic)
- Redis (Upstash): $10/month (beyond free tier)

### Both Share
- Cloud SQL: ~$50/month (one database, same cost)

---

## ✅ Verification Checklist

### After Development Deployment
- [ ] Service deployed: `gcloud run services describe humanchat-api-dev --region=us-central1`
- [ ] Health check passes: `curl https://humanchat-api-dev-xxxxx/health`
- [ ] Logs show no errors: `gcloud logs tail --filter="service_name=humanchat-api-dev"`
- [ ] Vercel preview connected to dev backend
- [ ] Can login and chat with Sam

### After Production Deployment
- [ ] Service deployed: `gcloud run services describe humanchat-api --region=us-central1`
- [ ] Health check passes: `curl https://humanchat-api-xxxxx/health`
- [ ] Logs show no errors: `gcloud logs tail --filter="service_name=humanchat-api"`
- [ ] Vercel production connected to prod backend
- [ ] Production URL works in browser
- [ ] OAuth login works
- [ ] Data persists correctly

---

## 🐛 Troubleshooting

### Wrong Environment Deployed

Check which environment is running:
```bash
# View environment variables
gcloud run services describe humanchat-api-dev \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### Secrets Not Found

List all secrets:
```bash
gcloud secrets list --project=YOUR_GCP_PROJECT_ID
```

Expected output:
```
DATABASE_URL
DATABASE_URL_DEV
FIREBASE_CLIENT_EMAIL
FIREBASE_CLIENT_EMAIL_DEV
FIREBASE_PRIVATE_KEY
FIREBASE_PRIVATE_KEY_DEV
FIREBASE_PROJECT_ID
FIREBASE_PROJECT_ID_DEV
GEMINI_API_KEY
GEMINI_API_KEY_DEV
REDIS_URL
REDIS_URL_DEV
```

### Service Crashes

View detailed logs:
```bash
# Development
gcloud logs read --filter="service_name=humanchat-api-dev AND severity>=ERROR" --limit=50

# Production
gcloud logs read --filter="service_name=humanchat-api AND severity>=ERROR" --limit=50
```

---

## 📚 Related Documentation

- [QUICKSTART_DEPLOY.md](./QUICKSTART_DEPLOY.md) - Quick deployment guide
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Step-by-step checklist
- [GOOGLE_CLOUD_RUN_DEPLOYMENT.md](./GOOGLE_CLOUD_RUN_DEPLOYMENT.md) - Full technical guide

---

## 🎯 Summary

You now have **two independent environments**:

1. **Development** (`humanchat-api-dev`)
   - For testing and development
   - Separate secrets with `_DEV` suffix
   - Lower resources, lower cost
   - Can break without affecting production

2. **Production** (`humanchat-api`)
   - For live users
   - Separate secrets (no suffix)
   - Full resources, optimized for performance
   - Stable and reliable

Both share the same Cloud SQL database but can use separate Redis instances for isolation.
