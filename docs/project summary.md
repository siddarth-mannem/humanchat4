# HumanChat Project Summary

## Current Focus
- Terraform now provisions Cloud Run domain mappings, Cloudflare DNS, and the WS service’s Cloud SQL connector attachment; the latest apply recreated both mappings (to fix namespace drift) and injected the shared `DATABASE_URL`/`POSTGRES_CRYPTO_KEY` env vars into the WebSocket container.
- Cloud Run API/WS revisions both pass direct `run.app` health probes, but `api.humanchat.com` and `ws.humanchat.com` are temporarily returning `525` while Google re-issues certificates after the mapping replacement.
- New `scripts/health-check.mjs` script (run via `node scripts/health-check.mjs`) captures `PASS/FAIL` status for both the custom domains and the direct hostnames so we can document promotion readiness after each Terraform apply.
- Local `.env` and `infra/terraform.tfvars` remain the single source for Firebase, Google, Stripe, Redis, and deployment secrets for reproducible applies and container builds.

## Backend Highlights
- Express-based API with Firebase-authenticated sessions, Redis-backed WebSocket signaling, and Stripe integrations.
- Robust token service reuses refresh sessions when possible and validates payloads with Zod-based error handling.
- Deployment artifacts include a production `Dockerfile`, `.dockerignore`, and Cloud Run deploy script supporting Artifact Registry builds and environment injection.

## Frontend Highlights
- Next.js 16 app under `apps/web` with Firebase session bridging, admin dashboards, and chat UI components.
- Extensive component library (booking flows, chat UI, profile views) plus hooks/services for API interaction.

## Testing & Tooling
- Jest projects split into `client` and `server` suites, run via `npm run test`/`test:api` with `ts-jest` ESM configuration.
- Playwright e2e suite (`npm run test:e2e`) and MSW handlers for API mocking.
- GitHub Actions workflow `.github/workflows/ci.yaml` now runs npm install, unit/integration/API/e2e suites, and the `node scripts/health-check.mjs` probe on every push/PR to `main`.
- Scripts folder contains deploy helpers, migration runners, and environment verification utilities.

## Infrastructure Roadmap
- Terraform now owns networking, Cloud Run services, Memorystore, Cloudflare DNS, Vercel config, domain mappings, and the Cloud SQL attachment for both API and WS services; Secret Manager wiring and CI/CD triggers are still out-of-band.
- `scripts/deploy-cloud-run.sh` still supports one-off rollouts, though the canonical path is `terraform apply` after Cloud Build publishes new images.
- Remaining infra work: bring the Cloud SQL instance/users/secrets under Terraform, harden Redis connectivity (new WS logs show `MaxRetriesPerRequestError` when ioredis can’t reach Memorystore), and retire the dormant Railway stack once parity checks pass.
- Layer in Cloud Monitoring uptime checks, alerting, the new health-check script, and rollback documentation before ramping traffic through the custom domains.

## Next Steps
1. Monitor the Cloud Run domain mappings after each apply and rerun `node scripts/health-check.mjs` once the certificates report `Ready`, saving the logs for change reviews.
2. Import/manage the Cloud SQL instance, users, and secrets in Terraform so the entire backend stack is codified; remove the old Railway resources afterward.
3. Wire Cloud Build + Terraform into GitHub Actions with workload identity federation to automate image builds and applies.
4. Add monitoring/alerting plus a runbook covering DNS rollback, Redis troubleshooting, and log triage so the new stack can be promoted with confidence.
