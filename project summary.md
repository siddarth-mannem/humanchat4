# HumanChat Project Summary

## Current Focus
- Manual Search Console verification is complete, letting Terraform own Cloud Run domain mappings for `api` and `ws`; the latest apply removed the old TXT flow and recreated mappings cleanly.
- Cloudflare CNAMEs now point to the Google-hosted targets emitted by the domain mappings, so traffic routes to GCP while Google-issued certificates advance from `CertificatePending` toward issuance.
- Cloud Run API/WS services are still built in Cloud Build and deployed via Terraform; both revisions return `200` on their direct `run.app` hostnames even though the `api.humanchat.com` health check still shows `525` until TLS finalizes.
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
- Scripts folder contains deploy helpers, migration runners, and environment verification utilities.

## Infrastructure Roadmap
- Terraform now owns networking, Cloud Run services, Memorystore, Cloudflare DNS, Vercel config, and the new domain mappings; Secret Manager wiring and CI/CD triggers are still out-of-band.
- `scripts/deploy-cloud-run.sh` still supports one-off rollouts, though the canonical path is `terraform apply` after Cloud Build publishes new images.
- Remaining infra work: bring the Cloud SQL instance/users/secrets under Terraform, finish validating connector reachability end-to-end, and retire the dormant Railway stack once parity checks pass.
- Layer in Cloud Monitoring uptime checks, alerting, and rollback documentation before ramping traffic through the custom domains.

## Next Steps
1. Monitor the Cloud Run domain mappings until the managed certificates turn `Ready`, then rerun the custom-domain `/health` checks and capture the results.
2. Import/manage the Cloud SQL instance, users, and secrets in Terraform so the entire backend stack is codified; remove the old Railway resources afterward.
3. Wire Cloud Build + Terraform into GitHub Actions with workload identity federation to automate image builds and applies.
4. Add monitoring/alerting plus a runbook covering DNS rollback and log triage so the new stack can be promoted with confidence.
