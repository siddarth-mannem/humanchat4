# Environment Setup Guide

## Overview
Use this guide to configure production, staging, and local environments for HumanChat. Secrets live in 1Password + provider secret managers; never commit them to git.

## Required Variables

| Scope | Key | Description |
| --- | --- | --- |
| Frontend | `NEXT_PUBLIC_API_URL` | HTTPS URL for the public API (`https://api.humanchat.com`). |
| Frontend | `NEXT_PUBLIC_WS_URL` | WSS endpoint for real-time updates. |
| Frontend | `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | Publishable Stripe key. |
| Frontend | `NEXT_PUBLIC_GEMINI_API_KEY` | Optional Gemini key for client-side experiments. |
| Frontend | `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key for client auth flows. |
| Frontend | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain (e.g., `project.firebaseapp.com`). |
| Frontend | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID so the client can bootstrap. |
| Backend | `FIREBASE_PROJECT_ID` | Same Firebase project ID used by the admin SDK. |
| Backend | `FIREBASE_CLIENT_EMAIL` | Service-account client email for Firebase Admin. |
| Backend | `FIREBASE_PRIVATE_KEY` | Private key (escape `\n`) for Firebase Admin credentials. |
| Backend | `DATABASE_URL` | Cloud SQL connection string (stored in Secret Manager as `cloudsql-database-url`). |
| Backend | `REDIS_URL` | Upstash Redis REST/Redis URL. |
| Backend | `JWT_SECRET` | 32+ char secret for user tokens. |
| Backend | `STRIPE_SECRET_KEY` | Live-mode Stripe secret. |
| Backend | `STRIPE_WEBHOOK_SECRET` | Webhook verifier from Stripe dashboard. |
| Backend | `GEMINI_API_KEY` | Server-side Gemini key. |
| Backend | `GOOGLE_OAUTH_CLIENT_ID` | OAuth client. |
| Backend | `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth secret. |
| Backend | `POSTGRES_CRYPTO_KEY` | Symmetric key used when encrypting calendar OAuth tokens (feeds `humanchat.crypto_key`). |

### Optional additions
- `SENTRY_DSN`, `POSTHOG_API_KEY`, `BETTER_UPTIME_HEARTBEAT`
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`

## Procedure
1. Duplicate `.env.example` to `.env` for local dev; fill with sandbox credentials.
2. Run `./scripts/verify-env.sh` before any deploy pipeline.
3. In Vercel project settings, add frontend keys under **Environment Variables → Production**.
4. In Cloud Run service configuration, set backend keys (or reference Secret Manager entries) for each environment.
5. Store master secrets in 1Password; reference them via GitHub Actions secrets (`VERCEL_TOKEN`, `GCP_SA_KEY`, etc.).
6. Rotate secrets quarterly or immediately after an incident; update IaC variable files and provider dashboards.

### Cloud SQL + Secret Manager
1. Create the Cloud SQL instance (e.g., `loyal-env-475400-u0:us-central1:users`) and confirm the target database (default `postgres`).
2. Reset or create a SQL user password, then store it in Secret Manager (`cloudsql-db-password`).
3. Create the connection-string secret:
	- `postgresql://postgres:<password>@/postgres?host=/cloudsql/<instance>` → `cloudsql-database-url`.
4. When deploying Cloud Run, pass `CLOUD_SQL_INSTANCES=<instance>` and set `SET_SECRETS="DATABASE_URL=cloudsql-database-url:latest,..."` so the service mounts the connector and reads the secret directly.
5. Keep Supabase credentials only for local development; production should exclusively reference the Cloud SQL secrets above.

## Promotion Flow
- Update staging environment first, run smoke tests.
- Once staging is healthy, copy values to production via provider dashboards or Terraform variable files/Secret Manager copy.

## Validation Checklist
- `npm run test` passes.
- `scripts/verify-env.sh` outputs "Environment ready.".
- `curl https://api.humanchat.com/health` returns 200 from staging + prod.
