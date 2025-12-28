# HumanChat Project Summary

## Current Focus (Dec 2025)
1. **Landing Page Cleanup** – modernize the hero, prune obsolete sections, and ensure marketing copy mirrors the “members helping members” positioning. Work happens under `apps/web/app/(marketing)/page.tsx` with shared styles in `globals.css`.
2. **Logout Reliability** – investigate sessions hanging inside Firebase/Next middleware, ensure `/api/logout` clears the Dexie cache, Sam state, and Stripe tokens, and add regression tests in `tests/api/auth.test.ts` + Playwright smoke flows.
3. **Chat Request Fixes** – the managed request pipeline (Dexie + IndexedDB sync + `/api/requests`) occasionally drops status transitions. We need database logging, MSW fixtures, and UI states in `ConversationSidebar`/`ChatArea` so requests never appear “stuck”.
4. **Free-to-Free Connections** – today two free members cannot instantly connect because availability gating requires either paid or charity context. We must relax the check in `AccountPreferencesForm`/`useSessionStatus`, add safeguards server-side, and update Sam’s recommendation logic so free profiles can connect directly.

## State of the Product
- **Backend**: Express API with Firebase-authenticated sessions, Redis-backed WebSocket signaling, Stripe integration for paid chats, and Dexie-powered persistence on the client. Deployments target Cloud Run via the shared `Dockerfile` and `scripts/deploy-*.sh` helpers.
- **Frontend**: Next.js 16 (`apps/web`) handles marketing, onboarding, settings, and chat. Component highlights include Booking flows, Sam concierge UI, ProfileCard, and AccountPreferencesForm.
- **Testing**: Jest projects (`client`/`server`) + Playwright e2e (`e2e/chat-flow.spec.ts`). MSW mocks cover calendar/sam/payment endpoints. Run with `npm run test`, `npm run test:api`, and `npx playwright test`.
- **Infrastructure**: Terraform manages Cloud Run services, domain mappings, Cloudflare DNS, Upstash Redis, and the Neon-backed secret/env plumbing for the WebSocket service. Health probes live in `scripts/health-check.mjs`. Secrets still come from `.env` + `infra/terraform.tfvars` pending Secret Manager adoption.

## Priority Action Plan
| Priority | Owner | Status | Notes |
| --- | --- | --- | --- |
| Landing page cleanup | Web team | TODO | Audit `apps/web/app/(marketing)` content, remove stale testimonial sections, re-theme CTA buttons, and ensure Lighthouse stays >90. |
| Logout fix | Auth/API | In progress | Confirm `/api/logout` invalidates Firebase refresh tokens, clears Dexie tables, and updates the `sessionStatusManager`. Add regression coverage in Jest + Playwright. |
| Chat requests issues | Chat team | In progress | Instrument `saveManagedRequest`, add request lifecycle logs, and patch `ConversationSidebar` so UI reflects pending/approved states even when the socket lags. |
| Free-to-free connections | Product/Backend | Blocked on spec | Need product sign-off for rate limits + abuse protections. Implementation touches `AccountPreferencesForm`, Sam concierge responses, and `/api/sessions`. |

## Supporting Work
- Expand health-check automation so every Terraform apply captures custom-domain readiness.
- Finish codifying Neon (branches/users/secrets) under Terraform and retire the old Railway stack once parity is verified.
- Document rollback procedures for DNS, Redis connectivity (ioredis `MaxRetriesPerRequestError`), and Cloud Run revisions.

## Next Steps
1. Land the landing-page redesign PR, then rerun Lighthouse/LHCI for regression baselines.
2. Ship the logout fix behind a feature flag, monitor via Sentry metrics, and remove the flag once error rates drop.
3. Add request lifecycle telemetry + MSW fixtures, then validate in Playwright before announcing reliability fixes.
4. Finalize the spec for free-to-free connects, implement API + UI changes, and update Sam concierge scripts/tests accordingly.
5. Continue codifying infra (Neon, Secret Manager, monitoring alerts) so deploys remain reproducible.
