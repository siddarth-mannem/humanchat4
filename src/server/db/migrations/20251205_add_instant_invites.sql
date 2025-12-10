CREATE TABLE IF NOT EXISTS instant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  requester_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instant_invites_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_instant_invites_target_status ON instant_invites(target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_instant_invites_conversation ON instant_invites(conversation_id);
CREATE INDEX IF NOT EXISTS idx_instant_invites_requester ON instant_invites(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_instant_invites_expires_at ON instant_invites(expires_at);

DROP TRIGGER IF EXISTS instant_invites_set_updated_at ON instant_invites;
CREATE TRIGGER instant_invites_set_updated_at
  BEFORE UPDATE ON instant_invites
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
