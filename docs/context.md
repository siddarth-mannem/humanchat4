# HumanChat - AI Development Context

## Product Summary
Real-time connection platform where users talk via instant/scheduled calls.
AI concierge (Sam) handles discovery, scheduling, payments through chat.

## Tech Stack Requirements
- Frontend: React/Next.js with TypeScript
- State: IndexedDB (Dexie.js) for local storage
- AI: Gemini API for Sam
- Video: WebRTC or Daily.co/Twilio
- Payments: Stripe
- Calendar: Google/Microsoft/Apple integrations

## UI Layout
- LEFT SIDEBAR: All conversations (Sam always pinned at top, then human chats)
- MAIN AREA: Active conversation view (Sam chat or human session)
- Sam is always accessible, never closes
- Everything in single-window interface (no popups/new tabs)

## Core User Flow
1. User chats with Sam in main area
2. Sam shows profiles with rates/availability
3. User connects instantly OR books scheduled slot
4. New human conversation appears in sidebar
5. Click conversation → main area switches to video + chat view
6. Session ends → payment processed, conversation archived in sidebar

## Online Status Logic
- **Online (green)**: Available for instant connection
- **Online • In Call (yellow)**: Currently in active session, can still book scheduled
- **Offline (gray)**: Not available for instant, only scheduled booking

## Key Business Rules
- Minimum call: 15 minutes
- Buffer between calls: 5 minutes
- Three conversation types: Free, Paid, Charity
- Managed accounts have confidential rates
- Managed accounts route through representatives (Send Request → rep responds within 24h, no instant connect)
- Calendar sync every 5 min
- Users can be online but busy (in another call)
- Requested people requests are logged (individual + aggregated) when Sam or search cannot find a person, so ops can reach out later

## Data Lives In
- IndexedDB: conversations, messages, sessions, settings
- Backend: user profiles, availability, payments, session status

## Layout Reference
┌─────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────────────┐ │
│  │          │  │                      │ │
│  │  Sam 🔵  │  │   MAIN CONVERSATION  │ │
│  │ (pinned) │  │       AREA           │ │
│  │          │  │                      │ │
│  ├──────────┤  │  (Sam chat view OR   │ │
│  │          │  │   Human session view)│ │
│  │ Priya 🟢 │  │                      │ │
│  │ Active   │  │                      │ │
│  │          │  │                      │ │
│  ├──────────┤  │                      │ │
│  │          │  │                      │ │
│  │ Alex 🟡  │  │                      │ │
│  │ In Call  │  │                      │ │
│  │          │  │                      │ │
│  └──────────┘  └──────────────────────┘ │
│   SIDEBAR           MAIN AREA            │
└─────────────────────────────────────────┘