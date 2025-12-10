ALTER TABLE users
  ADD COLUMN IF NOT EXISTS presence_state VARCHAR(16) NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill existing rows based on current is_online flag
UPDATE users
SET presence_state = CASE
    WHEN has_active_session THEN 'active'
    WHEN is_online THEN 'active'
    ELSE 'offline'
  END,
    last_seen_at = NOW()
WHERE presence_state IS NULL OR presence_state = 'offline';
