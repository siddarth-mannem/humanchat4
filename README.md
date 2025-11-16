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
- `STRIPE_PLATFORM_FEE_BPS` (optional, defaults to `1000` → 10%)
- `STRIPE_CHARITY_CONNECT_ACCOUNT` (optional default destination for charity payouts)
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, defaults to `gemini-1.5-flash`)

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
- **requests**: managed account booking requests keyed by requestId with manager/requester filters

Each helper function includes defensive error handling and enforces the 15-minute minimum session duration required by the business rules. Future schema updates can be added by appending to the `schemaMigrations` array in `src/lib/db.ts` and providing an `upgrade` handler when data transforms are necessary.

## Backend Highlights

- **Routing & Middleware:** Centralized response format, JWT auth, role-based rate limiting, and structured error handling.
- **Data Access:** Typed services for users, sessions, conversations, payments, calendars, requests, and Sam AI chat orchestrations.
- **Realtime:** WebSocket hub exposes `/session/:sessionId`, `/status`, and `/notifications/:userId` backed by Redis pub/sub for cross-instance fan-out.
- **Payments:** Expanded Stripe service manages intents, Connect onboarding, transfers, tips/donations, and webhook-driven status updates.
- **Documentation:** `openapi.yaml` captures the REST contract for quick import into tools like Postman or Stoplight.
- **Gemini Concierge:** `sendToSam` streams conversation history + UI context to Google Gemini, enforces JSON-only responses, and validates structured Sam actions before persisting them.

## Charity & Donation Experience

- **Conversation types:** Hosts can mark profiles as `free`, `paid`, or `charity`. Charity conversations automatically surface the 💚 badge, route funds to the designated charity Connect account, and display "100% goes to charity" messaging across tiles and session HUDs.
- **Tips & donations:** When `donationPreference === 'on'`, the session end flow surfaces a "Send thanks" CTA that launches an in-app tip modal with suggested amounts ($5, $10, $20, custom). The modal calls `/api/payments/donation`, which spins up a Stripe Checkout session tied to the same payout target (host or charity).
- **Session receipts:** `stripeService.generateReceipt` now returns payment mode, charity name, donation allowance, and donation totals so clients can render impact summaries like "Your $40 supports Girls Who Code".
- **Automatic routing:** After a session PaymentIntent is captured the backend immediately kicks off a Connect transfer via Stripe's Transfer API. Charity sessions waive platform fees (configurable via `STRIPE_PLATFORM_FEE_BPS`) and land in the charity's Connect account, while paid sessions send the post-fee share to the host.

## Managed & Confidential Profiles

- **Profile tiles:** When Sam surfaces a managed profile (`managed: true` + `confidentialRate: true`) the rate stack swaps to a purple "Available by Request" badge, hides the instant "Connect Now" control, and replaces "Book Time" with "Send Request".
- **Request form:** Clicking "Send Request" launches `RequestForm`, which captures intent, optional timing, and (when allowed) a budget range before calling `/api/requests`. Successful submissions are saved locally in the new Dexie `requests` store and logged back into the Sam conversation with the "Request sent to [Rep Name]" confirmation.
- **Backend workflow:** The API enforces managed-only access, stores preferred time/budget metadata, and associates each request with the manager/representative so future tooling can notify them and approve/decline with a confidential rate.
- **Sessions:** Any session hydrated with `confidentialRate` displays "Private Rate" inside the HUD, suppresses Stripe collection, and informs the guest that the representative will finalize billing offline.

## Requested People Tracking

- **Automatic logging:** Every time a member searches for or asks Sam to connect with someone who isn’t yet on HumanChat, the platform logs both the individual query (`request_logs`) and the aggregated totals (`requested_people`). Names are normalized (`"Elon Musk" → "elonmusk"`) to deduplicate variations.
- **Sam messaging:** When Sam detects a request for an unavailable person, it acknowledges the ask, confirms the interest was recorded, and offers to recommend similar profiles.
- **Admin dashboard:** Visit `/admin/requests` in the Next.js app to review the aggregated table, filter by status (pending/contacted/declined/onboarded), and update outreach progress inline.

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

## Mobile + PWA Experience

- **Bottom navigation:** The chat workspace now swaps the desktop sidebar for a four-tab bottom nav (Home, Discover, Sam, Profile) under 768px, including unread indicators and full-screen conversation states with a back affordance.
- **Gestures & pull-to-refresh:** Swipe left on any conversation to archive it, swipe right on a message to quote-reply instantly, and pull down on the list to trigger a Dexie-backed refresh.
- **Adaptive video calls:** Video stages automatically lock to portrait on phones, 4:3 landscape on tablets, and 16:9 on desktop, with optional picture-in-picture, native invite sharing, and automatic landscape rotation once connected.
- **Performance & accessibility:** Message panes use virtual scrolling, avatars lazy-load, uploads are compressed client-side, and global settings respect font scaling, high-contrast mode, and keyboard focus outlines.
- **PWA essentials:** A manifest, offline-first service worker, install prompt, background sync hooks, and push notifications (call reminders, new messages, payment receipts) round out the installable experience.
