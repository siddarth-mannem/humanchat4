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
| Frontend | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by the browser client. |
| Frontend | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key for client-side auth. |
| Backend | `SUPABASE_JWT_SECRET` | Supabase JWT secret (Settings → API) so the API can verify Supabase sessions. |
| Backend | `DATABASE_URL` | Postgres connection string from Supabase/Railway. |
| Backend | `REDIS_URL` | Upstash Redis REST/Redis URL. |
| Backend | `JWT_SECRET` | 32+ char secret for user tokens. |
| Backend | `SUPABASE_JWT_SECRET` | JWT secret from Supabase (Settings → API) used to verify auth tokens. |
| Backend | `STRIPE_SECRET_KEY` | Live-mode Stripe secret. |
| Backend | `STRIPE_WEBHOOK_SECRET` | Webhook verifier from Stripe dashboard. |
| Backend | `GEMINI_API_KEY` | Server-side Gemini key. |
| Backend | `GOOGLE_OAUTH_CLIENT_ID` | OAuth client. |
| Backend | `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth secret. |

### Optional additions
- `SENTRY_DSN`, `POSTHOG_API_KEY`, `BETTER_UPTIME_HEARTBEAT`
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`

## Procedure
1. Duplicate `.env.example` to `.env` for local dev; fill with sandbox credentials.
2. Run `./scripts/verify-env.sh` before any deploy pipeline.
3. In Vercel project settings, add frontend keys under **Environment Variables → Production**.
4. In Railway services (`api`, `ws`), paste backend keys for each environment.
5. Store master secrets in 1Password; reference them via GitHub Actions secrets (`VERCEL_TOKEN`, `RAILWAY_TOKEN`, etc.).
6. Rotate secrets quarterly or immediately after an incident; update IaC variable files and provider dashboards.

## Promotion Flow
- Update staging environment first, run smoke tests.
- Once staging is healthy, copy values to production via provider dashboards or `railway variables copy`.

## Validation Checklist
- `npm run test` passes.
- `scripts/verify-env.sh` outputs "Environment ready.".
- `curl https://api.humanchat.com/health` returns 200 from staging + prod.
