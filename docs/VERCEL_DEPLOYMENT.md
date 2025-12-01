# Vercel Deployment Guide for HumanChat

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  User Browser                                               │
│  └─> https://humanchat4.vercel.app                         │
│                                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ (Static Files + Client-Side React)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Vercel (Frontend Only)                                     │
│  - Next.js App                                              │
│  - Static Assets                                            │
│  - Client-Side Routing                                      │
│                                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ (API Calls to NEXT_PUBLIC_API_URL)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Railway/Cloud Run (Backend API)                            │
│  - Express Server (Port 4000)                               │
│  - WebSocket Server                                         │
│  - REST API Routes                                          │
│  - Connects to Cloud SQL + Redis                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step Deployment

### 1. Deploy Backend First (Railway)

#### A. Create Railway Project
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init
```

#### B. Configure Railway Environment Variables
Add in Railway Dashboard → Variables:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://postgres:PASSWORD@/postgres?host=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:users
REDIS_URL=redis://default:password@redis.railway.internal:6379
JWT_SECRET=generate-new-secret-for-production
JWT_EXPIRES_IN=12h
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_PREFIX-0rdld5mq1u7a4f2f33u6ku4g5ij77umr.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://your-backend.up.railway.app/api/auth/google/callback
CORS_ORIGIN=https://humanchat4.vercel.app
FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT
FIREBASE_CLIENT_EMAIL=humanchat-firebase-admin@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
```

#### C. Configure Railway Build
In `railway.toml` (create in root):

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "api"
```

#### D. Deploy
```bash
railway up
```

Copy your Railway URL: `https://humanchat4-production.up.railway.app`

---

### 2. Deploy Frontend to Vercel

#### A. Vercel Dashboard Settings

**Framework Preset:** Next.js  
**Root Directory:** `/` (leave as root)  
**Build Command:** `npm run web:build`  
**Output Directory:** `apps/web/.next`  
**Install Command:** `npm install`  

#### B. Environment Variables in Vercel

Add these in Vercel → Settings → Environment Variables:

```env
# Production Environment
NODE_ENV=production

# Backend API URLs (Replace with your Railway URL)
NEXT_PUBLIC_API_URL=https://humanchat4-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://humanchat4-production.up.railway.app

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_PREFIX-0rdld5mq1u7a4f2f33u6ku4g5ij77umr.apps.googleusercontent.com

# Firebase Web Config
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_PROJECT.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_PROJECT.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=328021368944
NEXT_PUBLIC_FIREBASE_APP_ID=1:328021368944:web:9e8e92986e067e0aec14b5
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-1YYJ2XT2SE
```

#### C. Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Or push to GitHub and connect repo in Vercel Dashboard.

---

### 3. Update Google OAuth Redirect URIs

Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

Add these Authorized Redirect URIs:
- `https://humanchat4.vercel.app`
- `https://humanchat4-production.up.railway.app/api/auth/google/callback`

Add these Authorized JavaScript Origins:
- `https://humanchat4.vercel.app`
- `https://humanchat4-production.up.railway.app`

---

### 4. Update CORS in Backend

In `src/server/app.ts`, ensure CORS allows Vercel domain:

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://humanchat4.vercel.app',
  credentials: true
}));
```

---

## Verification Checklist

- [ ] Backend API deployed to Railway
- [ ] Railway environment variables configured
- [ ] Railway URL obtained (e.g., `https://xxx.up.railway.app`)
- [ ] Frontend deployed to Vercel
- [ ] Vercel environment variables set with Railway URL
- [ ] Google OAuth redirect URIs updated
- [ ] CORS configured in backend
- [ ] Database migrations run on production DB
- [ ] Redis connected
- [ ] Test authentication flow
- [ ] Test WebSocket connections

---

## Database Migrations for Production

```bash
# Run migrations on production database
DATABASE_URL='postgresql://postgres:PASSWORD@/postgres?host=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:users' npm run db:migrate
```

---

## Troubleshooting

### Frontend can't reach API
- Check `NEXT_PUBLIC_API_URL` in Vercel env vars
- Verify Railway backend is running
- Check CORS settings in backend

### Authentication failing
- Verify Google OAuth redirect URIs
- Check Firebase config in Vercel
- Ensure JWT_SECRET is set in Railway

### WebSocket not connecting
- Ensure `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
- Check Railway allows WebSocket connections (it does by default)

---

## Production URLs

- **Frontend:** https://humanchat4.vercel.app
- **Backend API:** https://humanchat4-production.up.railway.app
- **WebSocket:** wss://humanchat4-production.up.railway.app

---

## Cost Estimate

- **Vercel:** Free tier (Hobby plan)
- **Railway:** ~$5-20/month depending on usage
- **Cloud SQL:** Already running
- **Redis:** ~$5-10/month on Railway

---

## Alternative: Monorepo on Single Service

If you want everything on one service, deploy to:
- **Google Cloud Run** (serverless)
- **Render** (simpler than Railway)

But this requires adjusting your build process to serve both frontend and backend from one Express server.
