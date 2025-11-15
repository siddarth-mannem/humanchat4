# HumanChat Workspace

This workspace hosts both the offline-first IndexedDB layer **and** the backend API stack for the HumanChat application. Frontend clients can use `src/lib/db.ts` for local caching, while the Express + PostgreSQL backend (under `src/server`) powers authentication, Sam concierge orchestration, scheduling, payments, and notifications defined in `context.md`.

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
npm install
```

Copy `.env.example` or export the following environment variables before running the API:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

> Defaults in `src/server/config/env.ts` allow local tinkering without secrets, but real deployments should override them.

## Available Scripts

- `npm run build` – Type-checks and emits the backend + shared libs to `dist`
- `npm test` – Runs the Vitest suite (uses `fake-indexeddb` for Node-based IndexedDB emulation)
- `npm run test:watch` – Watch mode for faster feedback
- `npm run dev` – Starts the Express API + WebSocket hub via `tsx`
- `npm start` – Runs the compiled server (`dist/server/index.js`)
- `npm run web:dev` – Launches the Next.js preview app under `apps/web`
- `npm run web:build` – Builds the frontend for production
- `npm run web:start` – Serves the built frontend locally

## Project Structure

```
src/
  lib/db.ts              # Dexie schema, helper functions, and migrations
  server/
    app.ts               # Express app wiring (middleware, routing)
    index.ts             # HTTP + WebSocket bootstrapper
    config/env.ts        # Centralized environment handling
    db/                  # PostgreSQL + Redis clients
    middleware/          # Auth, rate-limit, error handling
    routes/              # REST endpoints grouped by domain
    services/            # Business logic + persistence helpers
    websocket/           # Signaling + status channels
context.md               # Product and technical context
openapi.yaml             # REST contract for quick reference
README.md                # This file
```

## Dexie Schema Overview

- **conversations**: conversation metadata, unread counts, and session linkage
- **messages**: timestamped chat history with optional Sam actions
- **sessions**: voice/video sessions with pricing and lifecycle status
- **settings**: arbitrary key/value store for client preferences

Each helper function includes defensive error handling and enforces the 15-minute minimum session duration required by the business rules. Future schema updates can be added by appending to the `schemaMigrations` array in `src/lib/db.ts` and providing an `upgrade` handler when data transforms are necessary.

## Backend Highlights

- **Routing & Middleware:** Centralized response format, JWT auth, role-based rate limiting, and structured error handling.
- **Data Access:** Typed services for users, sessions, conversations, payments, calendars, requests, and Sam AI chat orchestrations.
- **Realtime:** WebSocket hub exposes `/session/:sessionId`, `/status`, and `/notifications/:userId` backed by Redis pub/sub for cross-instance fan-out.
- **Payments:** Stripe helpers handle intents, capture, refunds, and webhook signature verification.
- **Documentation:** `openapi.yaml` captures the REST contract for quick import into tools like Postman or Stoplight.

## Frontend Preview (Next.js)

The `apps/web` folder now hosts an app-router Next.js client that renders the fixed conversation sidebar **and** a fully responsive conversation workspace backed by the Dexie cache:

- Sam Concierge stays pinned at the top with its own avatar treatment.
- Human conversations are sorted by `lastActivity` and show avatars, previews, relative timestamps, unread badges, and live session status chips.
- The main pane swaps between the Sam chat UI (with structured action buttons + composer) and the human session view (video placeholder + chat, countdown for scheduled sessions, read-only archives when complete).
- Sam responses include rich action renderers (profile decks, connection offers, scheduling slots, booking confirmations) and integrate with the backend concierge endpoint for replies.
- Selecting a conversation highlights it and keeps per-thread scroll positions for smooth transitions.
- On narrow screens the sidebar collapses to an icon strip for quick navigation.
- Data flows from IndexedDB via a `liveQuery`, so updates in the Dexie stores instantly refresh both the list and the active conversation view.

Use `npm run web:dev` to boot the preview alongside any backend work. The component gracefully handles empty states until real data lands in the `conversations` store.
