# HumanChat

Modern concierge messaging for connecting members with humans, mentors, and Sam (AI) assistants. This monorepo contains the production Next.js web client, Express/Node API + WebSocket hub, Dexie offline cache, and all shared domain logic.

## Quick Start

```bash
git clone https://github.com/mouryay/humanchat4.git
cd humanchat4
npm install
cp .env.example .env   # fill with local secrets
npm run dev             # starts API + websocket
npm run web:dev         # (new tab) starts the Next.js client
```

Use `npm run test` to verify the suite before shipping.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind, Zustand, React Query
- **Backend**: Express 5, Node 18, PostgreSQL (Cloud SQL), Redis (Upstash)
- **Realtime**: WebSockets on Cloud Run + Redis pub/sub
- **AI**: Google Gemini for Sam concierge orchestration
- **Payments**: Stripe Connect + webhooks
- **Testing**: Jest + React Testing Library, Playwright e2e, MSW, fake-indexeddb
- **Infra**: Vercel (web), Google Cloud Run (API & WS), Cloud SQL for Postgres, Firebase Auth, Upstash Redis, Cloudflare DNS

## Folder Structure

```
apps/
  web/                 # Next.js client
docs/                  # Developer + ops documentation
infra/                 # Terraform modules
scripts/               # Deployment helpers and env checks
src/
  lib/                 # Dexie offline cache + helpers
  server/              # Express API, WebSocket services, routes
tests/                 # Jest + API + MSW suites
```

More detail is available in `ARCHITECTURE.md` and `COMPONENTS.md`.

## Environment Setup
1. Install Node.js 18+ and npm 9+.
2. Duplicate `.env.example` and fill the backend keys listed in `docs/environment.md`.
3. For the frontend, configure `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, and the Firebase web keys alongside Stripe/Gemini public keys.
4. Start Redis/Postgres locally or point to staging resources.
5. Run `./scripts/verify-env.sh` to assert required secrets.

## Running Locally

### Backend API & WS
```bash
npm run dev
```
Serves REST endpoints on `http://localhost:4000` and a WebSocket hub on `/ws`.

### Web Client
```bash
npm run web:dev
```
Launches the Next.js client on `http://localhost:3000`. It uses Dexie for offline caching and talks to the local API.

### Test Matrix
- `npm run test:unit` – all client tests (components + Dexie helpers)
- `npm run test:api` – backend integration tests via Supertest
- `npm run test:e2e` – Playwright chat flow

## 🚀 Deployment

Ready to deploy to production? Start here:

→ **[DEPLOYMENT_INDEX.md](./DEPLOYMENT_INDEX.md)** - Choose your deployment path

Quick links:
- **[QUICKSTART_DEPLOY.md](./QUICKSTART_DEPLOY.md)** - Deploy in 5 steps (10 minutes)
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Interactive checklist
- **[GOOGLE_CLOUD_RUN_DEPLOYMENT.md](./GOOGLE_CLOUD_RUN_DEPLOYMENT.md)** - Full technical guide

## Additional References
- `ARCHITECTURE.md` – diagrams, data flow, state management
- `API_DOCS.md` – REST endpoints, auth, and rate limits
- `COMPONENTS.md` – component library reference
- `DEPLOYMENT.md` – prod/staging deployment workflow
- `VERCEL_DEPLOYMENT.md` – frontend deployment to Vercel
- `CONTRIBUTING.md` – coding standards and PR requirements
- `docs/` – env setup, monitoring, backup, incident response

Questions? Ping `#humanchat-dev` in Slack or open an issue.
