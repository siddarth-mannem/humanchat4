# Component Library

Reference for key React components in `apps/web/components/`.

## ConversationSidebar
- **Props**
  - `conversations: Conversation[]`
  - `activeConversationId?: string`
  - `onSelect(conversationId: string)`
- **Usage**
```tsx
<ConversationSidebar
  conversations={conversations}
  activeConversationId={activeId}
  onSelect={setActiveId}
/>
```
- Highlights unread counts, session chips, online state.

## ConversationListItem
- **Props**: `conversation`, `isActive`, `onClick`.
- Shows avatar, name, last message preview, relative timestamp.

## ConversationView
- **Props**: `conversation`, `messages`, `session`, `onSendMessage`.
- Renders chat scrollable area + composer, defers message rendering to `MessageBubble`.

## MessageBubble
- **Props**: `message`, `isOwn`, `onQuote`.
- Supports text, Sam actions, attachments. Tests in `MessageBubble.test.tsx` cover quote + status badges.

## ActionRenderer
- **Props**: `action: SamAction`.
- Displays card decks (profiles), booking slots, confirmations. Ensure all Sam action variants map to a React node.

## SamChatView
- Combines `ChatArea`, `ActionRenderer`, `Sam composer`. Handles Sam typing indicators and streaming.

## BookingModal
- Props: `open`, `profile`, `conversation`, `onClose`.
- Flow: load slots → select slot (`CalendarSlotPicker`) → confirm (`BookingConfirmation`) → success state.
- Test `BookingModal.test.tsx` documents expected interactions.

## CalendarSlotPicker
- Props: `slots`, `timezone`, `getPriceForDuration`, `onSelect`, `loading`, `error`.
- Emits `(slot, durationMinutes, price)` to parent.

## VideoCallPanel
- Props: `session`, `onLeave`, `onEnd`, `mediaState`.
- Manages placeholder video layout + call controls. Tests stub WebRTC APIs.

## StatusBadge / CharityBadge / RateDisplay
- Stateless display components for availability and pricing callouts.

## Admin Components
- `AdminRequestedPeopleTable` – managed outreach pipeline.
- `ProfileCard` – summary tiles with CTA logic.
- `DiscoverPanel` – curated feed of mentors.

## Hooks
- `useConversationData`, `useConversationDetail` – wrap Dexie live queries.
- `useSessionStatus` – maps conversation → realtime session metadata.
- `useInstallPrompt` – handles PWA install events.

## Storybook / Examples
- Storybook not yet wired; use Jest + Playwright snapshots. For visual QA, run `npm run web:dev` with MSW handlers enabled (`tests/msw/handlers.ts`).

## Styling
- CSS Modules per component (e.g., `ConversationSidebar.module.css`). Tailwind used for global utility classes in `app/globals.css`.

## Prop Typing
- All components are typed via TypeScript interfaces imported from `apps/web/types` or `src/lib/db`. Follow existing patterns when extending functionality.
