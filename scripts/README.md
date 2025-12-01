# 📜 Scripts Reference

All deployment and utility scripts in the `scripts/` directory.

## 🚀 Deployment Scripts

### `setup-secrets.sh`
**Purpose**: Upload environment variables to Google Secret Manager

**Usage**:
```bash
./scripts/setup-secrets.sh
```

**What it does**:
- ✅ Enables Secret Manager API
- ✅ Reads variables from `.env.local`
- ✅ Creates secrets in Google Cloud
- ✅ Grants Cloud Run access to secrets

**Prerequisites**:
- `.env.local` file exists with all variables
- `gcloud` CLI authenticated
- Billing enabled on GCP project

---

### `deploy-cloud-run.sh`
**Purpose**: Build and deploy backend to Google Cloud Run

**Usage**:
```bash
# Full deployment (build + deploy)
./scripts/deploy-cloud-run.sh

# Skip Docker build (deploy existing image)
SKIP_BUILD=1 ./scripts/deploy-cloud-run.sh

# Custom configuration
PROJECT_ID=my-project REGION=us-east1 ./scripts/deploy-cloud-run.sh
```

**What it does**:
- 🔨 Builds Docker image
- 📤 Pushes to Google Container Registry
- 🚢 Deploys to Cloud Run
- 🔗 Connects to Cloud SQL
- 🔐 Loads secrets from Secret Manager
- ✅ Outputs service URL

**Prerequisites**:
- Docker Desktop running
- `gcloud` authenticated
- Secrets uploaded (run `setup-secrets.sh` first)
- APIs enabled

**Environment Variables**:
- `PROJECT_ID` - GCP project (default: `YOUR_GCP_PROJECT_ID`)
- `REGION` - Deployment region (default: `us-central1`)
- `SERVICE_NAME` - Service name (default: `humanchat-api`)
- `SKIP_BUILD` - Skip Docker build (default: `0`)

---

### `test-docker.sh`
**Purpose**: Test Docker build locally before deploying

**Usage**:
```bash
./scripts/test-docker.sh
```

**What it does**:
- 🔨 Builds Docker image locally
- 🧪 Tests container can start
- ✅ Verifies file structure
- 📊 Shows image size

**Use this to**:
- Verify Docker build works
- Catch build errors early
- Test before deploying to Cloud Run

---

## 🗄️ Database Scripts

### `run-migrations.ts`
**Purpose**: Run database schema migrations

**Usage**:
```bash
npm run db:migrate
```

**What it does**:
- 📋 Reads SQL files from `src/server/db/migrations/`
- ✅ Applies migrations in order
- 📝 Tracks applied migrations

**Use when**:
- Setting up new database
- Updating schema
- Before deployment

---

### `clear-backend-chat.ts`
**Purpose**: Clear chat data from database (dev only)

**Usage**:
```bash
npx tsx clear-backend-chat.ts
```

**What it does**:
- 🗑️ Deletes all messages
- 🗑️ Deletes all conversations
- ✅ Preserves users table

**⚠️ Warning**: Only use in development! This deletes production data.

---

### `check-backend-data.ts`
**Purpose**: View database contents

**Usage**:
```bash
npx tsx check-backend-data.ts
```

**What it does**:
- 📊 Shows count of users
- 📊 Shows count of conversations
- 📊 Shows count of messages

---

### `check-schema.ts`
**Purpose**: Verify database schema matches code

**Usage**:
```bash
npx tsx check-schema.ts
```

**What it does**:
- ✅ Checks table structures
- ✅ Verifies column names
- ✅ Lists foreign keys

---

## 🔧 Utility Scripts

### `seed-sam-conversations.ts`
**Purpose**: Seed database with Sam conversations for testing

**Usage**:
```bash
npx tsx scripts/seed-sam-conversations.ts
```

**What it does**:
- 🌱 Creates test Sam conversations
- 🌱 Adds sample messages
- ✅ Sets up test data

---

### `health-check.mjs`
**Purpose**: Check if services are healthy

**Usage**:
```bash
node scripts/health-check.mjs
```

**What it does**:
- 🏥 Tests API health endpoint
- 🏥 Checks database connection
- 🏥 Verifies Redis connection

---

### `sync-env.sh`
**Purpose**: Sync environment variables between local and cloud

**Usage**:
```bash
./scripts/sync-env.sh
```

**What it does**:
- 📋 Compares `.env.local` with Secret Manager
- ⚠️ Shows missing variables
- ✅ Validates configuration

---

### `verify-env.sh`
**Purpose**: Verify all required environment variables exist

**Usage**:
```bash
./scripts/verify-env.sh
```

**What it does**:
- ✅ Checks required variables
- ❌ Lists missing variables
- 📋 Validates format

---

### `web-build.ts`
**Purpose**: Build Next.js frontend

**Usage**:
```bash
npm run web:build
```

**What it does**:
- 🔨 Builds Next.js app
- ✅ Optimizes for production
- 📦 Generates static assets

---

## 🚀 Common Workflows

### First Time Deployment
```bash
# 1. Test Docker build
./scripts/test-docker.sh

# 2. Upload secrets
./scripts/setup-secrets.sh

# 3. Deploy to Cloud Run
./scripts/deploy-cloud-run.sh
```

### After Code Changes
```bash
# Redeploy backend
./scripts/deploy-cloud-run.sh

# Deploy frontend (if changed)
vercel --prod
```

### Database Updates
```bash
# Run new migrations
npm run db:migrate

# Verify schema
npx tsx check-schema.ts

# Check data
npx tsx check-backend-data.ts
```

### Debugging
```bash
# Check environment
./scripts/verify-env.sh

# Check service health
node scripts/health-check.mjs

# View Cloud Run logs
gcloud logs tail --filter="resource.labels.service_name=humanchat-api"
```

---

## 📋 Script Checklist

Before deploying, run these in order:

- [ ] `./scripts/verify-env.sh` - Verify environment variables
- [ ] `./scripts/test-docker.sh` - Test Docker build
- [ ] `npm run db:migrate` - Run migrations (if needed)
- [ ] `./scripts/setup-secrets.sh` - Upload secrets
- [ ] `./scripts/deploy-cloud-run.sh` - Deploy to Cloud Run
- [ ] `node scripts/health-check.mjs` - Verify deployment

---

## 🐛 Troubleshooting Scripts

### Script fails with "permission denied"
```bash
# Make script executable
chmod +x scripts/*.sh
```

### "gcloud: command not found"
```bash
# Install gcloud CLI
# https://cloud.google.com/sdk/docs/install
```

### "Docker: command not found"
```bash
# Install Docker Desktop
# https://www.docker.com/products/docker-desktop
```

### Script can't find .env.local
```bash
# Verify file exists
ls -la .env.local

# Check you're in project root
pwd  # Should end in /humanchat4
```

---

## 📚 Related Documentation

- [QUICKSTART_DEPLOY.md](../QUICKSTART_DEPLOY.md) - Quick deployment guide
- [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) - Step-by-step checklist
- [GOOGLE_CLOUD_RUN_DEPLOYMENT.md](../GOOGLE_CLOUD_RUN_DEPLOYMENT.md) - Full deployment guide
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Architecture overview

---

## 💡 Tips

- **Always test Docker build locally first** (`./scripts/test-docker.sh`)
- **Use `SKIP_BUILD=1` for faster redeployments** when only changing config
- **Check logs immediately after deployment** to catch issues early
- **Keep `.env.local` up to date** with all production variables
- **Run migrations before deploying** to avoid schema mismatches

---

## 🔐 Security Notes

- **Never commit `.env.local`** - it's in `.gitignore`
- **All secrets go through Secret Manager** - not in environment variables
- **Scripts validate permissions** before running
- **Use service accounts** for production deployments
- **Rotate secrets regularly** via Secret Manager

---

## 📞 Support

If a script isn't working:

1. Check prerequisites are met
2. Review error messages carefully
3. Check related documentation
4. View Cloud Run logs: `gcloud logs tail`
5. Verify secrets exist: `gcloud secrets list`

For detailed help, see [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) troubleshooting section.
