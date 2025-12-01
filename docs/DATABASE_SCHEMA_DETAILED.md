## Table Details

### 1. **users**
Stores all user accounts including hosts (experts) and guests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique user identifier |
| name | TEXT | NOT NULL | User's display name |
| email | CITEXT | NOT NULL, UNIQUE | Email address (case-insensitive) |
| password_hash | TEXT | | Hashed password for email/password auth |
| role | VARCHAR(16) | NOT NULL, DEFAULT 'user' | User role: 'user', 'admin' |
| avatar_url | TEXT | | Profile picture URL |
| headline | TEXT | | Short professional headline |
| bio | TEXT | | Longer biography/description |
| conversation_type | VARCHAR(16) | NOT NULL, DEFAULT 'free' | Default conversation type |
| donation_preference | TEXT | | User's donation preference |
| charity_id | TEXT | | Stripe charity account ID |
| charity_name | TEXT | | Name of charity |
| instant_rate_per_minute | INTEGER | | Per-minute rate for instant calls |
| scheduled_rates | JSONB | | Complex rate structures |
| is_online | BOOLEAN | NOT NULL, DEFAULT false | Current online status |
| has_active_session | BOOLEAN | NOT NULL, DEFAULT false | Currently in a session |
| managed | BOOLEAN | NOT NULL, DEFAULT false | Account managed by someone else |
| manager_id | UUID | FK → users(id) | Manager user ID (for managed accounts) |
| manager_display_name | TEXT | | Display name to show for manager |
| confidential_rate | BOOLEAN | | Hide rate from public |
| display_mode | VARCHAR(16) | | How to display profile info |
| stripe_account_id | TEXT | | Stripe Connect account ID |
| google_calendar_connected | BOOLEAN | | Google Calendar integration status |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_users_managed` on `managed`
- `idx_users_online` on `is_online`
- `idx_users_role` on `role`

---

### 2. **conversations**
Chat conversations between users, including Sam AI chats.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique conversation identifier |
| type | VARCHAR(16) | NOT NULL | 'sam', 'direct', 'session' |
| participants | UUID[] | NOT NULL, DEFAULT [] | Array of user IDs in conversation |
| linked_session_id | UUID | | Associated video session (if any) |
| last_activity | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last message timestamp |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Conversation creation timestamp |

**Indexes:**
- `idx_conversations_last_activity` on `last_activity DESC`

**Note:** Uses PostgreSQL array type for participants instead of junction table.

---

### 3. **messages**
Individual messages within conversations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique message identifier |
| conversation_id | UUID | FK → conversations(id) ON DELETE CASCADE | Parent conversation |
| sender_id | UUID | FK → users(id) ON DELETE SET NULL | Message sender (NULL for system) |
| content | TEXT | NOT NULL | Message text content |
| message_type | VARCHAR(32) | NOT NULL | 'user_text', 'sam_response', 'system_notice' |
| actions | JSONB | | Interactive actions/buttons in message |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Message timestamp |

**Indexes:**
- `idx_messages_conversation` on `(conversation_id, created_at)`

---

### 4. **sessions**
Video call sessions between host and guest users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique session identifier |
| host_user_id | UUID | FK → users(id) ON DELETE CASCADE | Host (expert) user |
| guest_user_id | UUID | FK → users(id) ON DELETE CASCADE | Guest (caller) user |
| conversation_id | UUID | FK → conversations(id) ON DELETE SET NULL | Associated chat |
| type | VARCHAR(16) | NOT NULL | 'instant', 'scheduled' |
| status | VARCHAR(16) | NOT NULL, DEFAULT 'pending' | Session status |
| start_time | TIMESTAMPTZ | | Actual/scheduled start time |
| end_time | TIMESTAMPTZ | | Actual/scheduled end time |
| duration_minutes | INTEGER | | Duration in minutes |
| agreed_price | INTEGER | | Price agreed in cents |
| payment_mode | VARCHAR(16) | NOT NULL, DEFAULT 'free' | 'free', 'paid', 'donation' |
| payment_intent_id | TEXT | | Stripe PaymentIntent ID |
| donation_allowed | BOOLEAN | | Allow donations |
| donation_target | TEXT | | Donation recipient type |
| donation_preference | TEXT | | User's donation preference |
| donation_amount | INTEGER | | Donation amount in cents |
| charity_id | TEXT | | Charity Stripe account |
| charity_name | TEXT | | Charity name |
| charity_stripe_account_id | TEXT | | Charity Stripe Connect ID |
| confidential_rate | BOOLEAN | | Rate kept confidential |
| representative_name | TEXT | | For managed accounts |
| display_mode | VARCHAR(16) | | Display mode for session |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Session creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_sessions_status` on `status`
- `idx_sessions_host` on `host_user_id`

---

### 5. **session_tokens**
Authentication tokens for logged-in users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| token_hash | TEXT | PRIMARY KEY | SHA-256 hash of token |
| user_id | UUID | FK → users(id) ON DELETE CASCADE | Token owner |
| remember_me | BOOLEAN | NOT NULL, DEFAULT false | Extended expiration |
| expires_at | TIMESTAMPTZ | NOT NULL | Token expiration time |
| last_used_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last activity with token |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Token creation timestamp |

**Indexes:**
- `idx_session_tokens_user` on `user_id`

---

### 6. **magic_links**
One-time passwordless login links sent via email.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| token_hash | TEXT | PRIMARY KEY | SHA-256 hash of token |
| user_id | UUID | FK → users(id) ON DELETE CASCADE | Link owner |
| remember_me | BOOLEAN | NOT NULL, DEFAULT false | Extended session |
| expires_at | TIMESTAMPTZ | NOT NULL | Link expiration (typically 15 min) |
| consumed | BOOLEAN | NOT NULL, DEFAULT false | Link has been used |
| consumed_at | TIMESTAMPTZ | | When link was used |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Link creation timestamp |

**Indexes:**
- `idx_magic_links_user` on `user_id`

---

### 7. **requests**
Booking/connection requests between users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique request identifier |
| requester_user_id | UUID | FK → users(id) ON DELETE CASCADE | User making request |
| target_user_id | UUID | FK → users(id) ON DELETE CASCADE | User receiving request |
| manager_user_id | UUID | FK → users(id) | Manager (for managed accounts) |
| representative_name | TEXT | | Rep name for managed accounts |
| message | TEXT | NOT NULL | Request message |
| preferred_time | TEXT | | Requested time |
| budget_range | TEXT | | Budget range |
| status | VARCHAR(16) | NOT NULL, DEFAULT 'pending' | 'pending', 'accepted', 'declined' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Request creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_requests_status` on `status`

---

### 8. **requested_people**
Tracks requests for people not yet on the platform.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| name | TEXT | NOT NULL | Person's name as requested |
| normalized_name | TEXT | NOT NULL, UNIQUE | Lowercase normalized name |
| request_count | INTEGER | NOT NULL, DEFAULT 0 | Number of requests |
| status | VARCHAR(32) | NOT NULL, DEFAULT 'pending' | Request status |
| last_requested_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Most recent request |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | First request timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

---

### 9. **request_logs**
Audit log of all person requests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique log entry identifier |
| user_id | UUID | FK → users(id) ON DELETE SET NULL | User who made request |
| requested_name | TEXT | NOT NULL | Name of person requested |
| search_query | TEXT | | Original search query |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Log entry timestamp |

**Indexes:**
- `idx_request_logs_user` on `user_id`

---

### 10. **calendar_connections**
Google/Microsoft/Apple Calendar integrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | UUID | FK → users(id) ON DELETE CASCADE (PK part 1) | Calendar owner |
| provider | VARCHAR(32) | NOT NULL (PK part 2) | 'google', 'microsoft', 'apple' |
| account_email | TEXT | NOT NULL | Connected account email |
| calendar_id | TEXT | NOT NULL | Calendar identifier |
| access_token | BYTEA | NOT NULL | Encrypted access token |
| refresh_token | BYTEA | NOT NULL | Encrypted refresh token |
| last_synced_at | TIMESTAMPTZ | | Last sync timestamp |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Connection creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Primary Key:** `(user_id, provider)` - one connection per provider per user

---

## Key Relationships

1. **Users → Conversations**: Users are stored in `conversations.participants` array
2. **Users → Messages**: One user can send many messages (`sender_id`)
3. **Conversations → Messages**: One conversation has many messages (1:N)
4. **Users → Sessions**: Users participate as host or guest in sessions (1:N)
5. **Conversations → Sessions**: Sessions link to conversation for chat (1:1 optional)
6. **Users → Auth Tokens**: Users have multiple session tokens and magic links (1:N)
7. **Users → Requests**: Users make and receive requests (N:M via requests table)
8. **Users → Calendar**: Users have multiple calendar connections (1:N)

---

## Special Features

### Array Type Usage
- `conversations.participants` uses PostgreSQL `UUID[]` array type instead of junction table
- Queried using `WHERE user_id = ANY(participants)`

### Encryption
- `calendar_connections.access_token` and `refresh_token` are stored as BYTEA (encrypted)
- Uses `humanchat.crypto_key` configuration parameter

### Automatic Timestamps
- `updated_at` columns automatically updated via trigger function `set_updated_at()`

### Cascade Deletes
- Deleting a user cascades to their sessions, tokens, and requests
- Deleting a conversation cascades to all messages
- Deleting a user sets message sender_id to NULL (preserves message history)

---

## Connection String

**Development (via Cloud SQL Proxy):**
```
postgresql://postgres:PASSWORD@localhost:5432/postgres
```

**Production:**
```
postgresql://postgres:PASSWORD@/postgres?host=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:users
```
