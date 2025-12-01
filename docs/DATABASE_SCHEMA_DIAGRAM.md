# HumanChat Database Schema (Google Cloud SQL)

**Updated:** November 23, 2025  
**Database:** PostgreSQL on Google Cloud SQL  
**Instance:** `YOUR_GCP_PROJECT_ID:us-central1:users`

---

## Schema Overview

The database consists of 10 main tables supporting user management, chat conversations, video sessions, authentication, and payment processing.

---

## Entity Relationship Diagram

```
                    ┌──────────────────────────────────────────────────────┐
                    │                       users                          │
                    ├──────────────────────────────────────────────────────┤
                    │ id (UUID) PK                                        │
                    │ name (TEXT)                                         │
                    │ email (CITEXT) UNIQUE                               │
                    │ password_hash (TEXT)                                │
                    │ role (VARCHAR) DEFAULT 'user'                       │
                    │ avatar_url (TEXT)                                   │
                    │ headline, bio (TEXT)                                │
                    │ conversation_type (VARCHAR) DEFAULT 'free'          │
                    │ donation_preference, charity_id, charity_name       │
                    │ instant_rate_per_minute (INTEGER)                   │
                    │ scheduled_rates (JSONB)                             │
                    │ is_online (BOOLEAN) DEFAULT false                   │
                    │ has_active_session (BOOLEAN) DEFAULT false          │
                    │ managed (BOOLEAN) DEFAULT false                     │
                    │ manager_id (UUID) → users(id)                       │
                    │ manager_display_name (TEXT)                         │
                    │ confidential_rate (BOOLEAN)                         │
                    │ display_mode (VARCHAR)                              │
                    │ stripe_account_id (TEXT)                            │
                    │ google_calendar_connected (BOOLEAN)                 │
                    │ created_at, updated_at (TIMESTAMPTZ)                │
                    └──────────────────────────────────────────────────────┘
                      ↑          ↑          ↑           ↑
                      │          │          │           │
         ┌────────────┴─┐  ┌────┴────┐  ┌──┴─────┐  ┌─┴──────────┐
         │              │  │         │  │        │  │            │
    participants    sender_id  host  guest  requester target
         │              │      │     │      │        │
         │              │      │     │      │        │
┌────────▼────────────────────┐│     │      │        │
│    conversations             ││     │      │        │
├──────────────────────────────┤│     │      │        │
│ id (UUID) PK                 ││     │      │        │
│ type (VARCHAR)               ││     │      │        │
│ participants (UUID[])        ││     │      │        │
│ linked_session_id (UUID)     ││     │      │        │
│ last_activity (TIMESTAMPTZ)  ││     │      │        │
│ created_at (TIMESTAMPTZ)     ││     │      │        │
└──────────────────────────────┘│     │      │        │
          ↑                      │     │      │        │
          │ conversation_id      │     │      │        │
          │                      │     │      │        │
┌─────────┴────────────┐    ┌───▼─────▼──────▼────────▼──────┐
│     messages         │    │        sessions                 │
├──────────────────────┤    ├─────────────────────────────────┤
│ id (UUID) PK         │    │ id (UUID) PK                    │
│ conversation_id (UUID)│    │ host_user_id (UUID) → users    │
│   → conversations(id)│    │ guest_user_id (UUID) → users   │
│ sender_id (UUID)     │    │ conversation_id (UUID)          │
│   → users(id)        │    │   → conversations(id)           │
│ content (TEXT)       │    │ type (VARCHAR)                  │
│ message_type (VARCHAR)│    │ status (VARCHAR) DEFAULT 'pending'│
│ actions (JSONB)      │    │ start_time, end_time (TIMESTAMPTZ)│
│ created_at (TIMESTAMPTZ)│  │ duration_minutes (INTEGER)      │
└──────────────────────┘    │ agreed_price (INTEGER)          │
                            │ payment_mode (VARCHAR) DEFAULT 'free'│
                            │ payment_intent_id (TEXT)        │
                            │ donation_allowed (BOOLEAN)      │
                            │ donation_target (TEXT)          │
                            │ donation_preference (TEXT)      │
                            │ donation_amount (INTEGER)       │
                            │ charity_id, charity_name (TEXT) │
                            │ charity_stripe_account_id (TEXT)│
                            │ confidential_rate (BOOLEAN)     │
                            │ representative_name (TEXT)      │
                            │ display_mode (VARCHAR)          │
                            │ created_at, updated_at (TIMESTAMPTZ)│
                            └─────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────────┐
│   session_tokens         │  │      magic_links             │
├──────────────────────────┤  ├──────────────────────────────┤
│ token_hash (TEXT) PK     │  │ token_hash (TEXT) PK         │
│ user_id (UUID) → users   │  │ user_id (UUID) → users       │
│ remember_me (BOOLEAN)    │  │ remember_me (BOOLEAN)        │
│ expires_at (TIMESTAMPTZ) │  │ expires_at (TIMESTAMPTZ)     │
│ last_used_at (TIMESTAMPTZ)│  │ consumed (BOOLEAN)           │
│ created_at (TIMESTAMPTZ) │  │ consumed_at (TIMESTAMPTZ)    │
└──────────────────────────┘  │ created_at (TIMESTAMPTZ)     │
                              └──────────────────────────────┘

┌─────────────────────────────────────┐  ┌───────────────────────────┐
│          requests                   │  │   requested_people        │
├─────────────────────────────────────┤  ├───────────────────────────┤
│ id (UUID) PK                        │  │ id (UUID) PK              │
│ requester_user_id (UUID) → users    │  │ name (TEXT)               │
│ target_user_id (UUID) → users       │  │ normalized_name (TEXT) UNIQUE│
│ manager_user_id (UUID) → users      │  │ request_count (INTEGER)   │
│ representative_name (TEXT)          │  │ status (VARCHAR)          │
│ message (TEXT)                      │  │ last_requested_at (TIMESTAMPTZ)│
│ preferred_time (TEXT)               │  │ created_at (TIMESTAMPTZ)  │
│ budget_range (TEXT)                 │  │ updated_at (TIMESTAMPTZ)  │
│ status (VARCHAR) DEFAULT 'pending'  │  └───────────────────────────┘
│ created_at, updated_at (TIMESTAMPTZ)│
└─────────────────────────────────────┘

┌───────────────────────────┐  ┌──────────────────────────────┐
│     request_logs          │  │   calendar_connections       │
├───────────────────────────┤  ├──────────────────────────────┤
│ id (UUID) PK              │  │ user_id (UUID) → users  }    │
│ user_id (UUID) → users    │  │ provider (VARCHAR)      } PK │
│ requested_name (TEXT)     │  │ account_email (TEXT)         │
│ search_query (TEXT)       │  │ calendar_id (TEXT)           │
│ created_at (TIMESTAMPTZ)  │  │ access_token (BYTEA)         │
└───────────────────────────┘  │ refresh_token (BYTEA)        │
                               │ last_synced_at (TIMESTAMPTZ) │
                               │ created_at, updated_at (TIMESTAMPTZ)│
                               └──────────────────────────────┘
```

---

## Quick Reference

### Core Tables
- **users** - User accounts (hosts and guests)
- **conversations** - Chat conversations (includes Sam AI)
- **messages** - Individual messages in conversations
- **sessions** - Video call sessions between users

### Authentication & Security
- **session_tokens** - Active login sessions
- **magic_links** - Passwordless login links
- **calendar_connections** - Calendar integrations (encrypted tokens)

### Booking & Requests
- **requests** - Session booking requests
- **requested_people** - Track requests for unavailable users
- **request_logs** - Audit log of all requests

---

## Key Design Decisions

### ✅ Implemented (Current Schema)

1. **UUID Primary Keys**: All tables use UUID for globally unique identifiers
2. **Array Type for Participants**: `conversations.participants` uses PostgreSQL UUID[] array
   - Simpler than junction table
   - Queried using `ANY(participants)` operator
   
3. **Soft Deletes for Messages**: When user deleted, `messages.sender_id` → NULL (preserves history)

4. **Cascade Deletes**: 
   - User deletion → removes sessions, tokens, requests
   - Conversation deletion → removes all messages
   
5. **Automatic Timestamps**: `updated_at` auto-updated via database trigger

6. **Case-Insensitive Email**: Uses PostgreSQL `CITEXT` type

7. **Token Security**: Stores SHA-256 hashes, not plaintext tokens

8. **Encrypted Calendar Tokens**: Stored as `BYTEA` with encryption

---

## Recent Migrations Applied

1. **20251116_add_role_to_users.sql** - Added role column to users table
2. **20251123_add_conversation_id.sql** - ❌ Reverted (created duplicate column)
3. **20251123_remove_duplicate_columns.sql** - Cleaned up duplicate columns
4. **20251123_revert_to_original_schema.sql** - ✅ Final: Removed conversation_id, uses id

### Current State
- ✅ All code uses `conversations.id` as primary identifier
- ✅ Foreign keys point to correct columns
- ✅ No duplicate columns
- ✅ Schema matches code expectations

---

## For Complete Table Details

See **[DATABASE_SCHEMA_DETAILED.md](./DATABASE_SCHEMA_DETAILED.md)** for:
- Complete column descriptions
- Data types and constraints
- Index definitions
- Relationship details
- Connection strings
