-- Migration: Add call sessions tables
-- Run with: npm run db:migrate

-- Call sessions table
CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Participants
  caller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Call metadata
  call_type VARCHAR(20) NOT NULL CHECK (call_type IN ('video', 'audio')),
  status VARCHAR(20) NOT NULL DEFAULT 'initiated' 
    CHECK (status IN (
      'initiated',
      'accepted',
      'connected',
      'ended',
      'declined',
      'missed',
      'canceled',
      'failed'
    )),
  
  -- Timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Duration tracking
  duration_seconds INTEGER,
  
  -- LiveKit integration
  livekit_room_id VARCHAR(255),
  livekit_room_name VARCHAR(255),
  
  -- Billing support
  is_paid BOOLEAN DEFAULT FALSE,
  agreed_price_cents INTEGER,
  
  -- Metadata
  end_reason VARCHAR(50),
  error_details JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_call_sessions_conversation ON call_sessions(conversation_id);
CREATE INDEX idx_call_sessions_caller ON call_sessions(caller_user_id);
CREATE INDEX idx_call_sessions_callee ON call_sessions(callee_user_id);
CREATE INDEX idx_call_sessions_status ON call_sessions(status);
CREATE INDEX idx_call_sessions_initiated_at ON call_sessions(initiated_at DESC);

-- Unique constraint: prevent duplicate active calls per conversation
CREATE UNIQUE INDEX idx_call_sessions_active_conversation 
  ON call_sessions(conversation_id) 
  WHERE status IN ('initiated', 'accepted', 'connected');

-- Call events table (audit log)
CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL 
    CHECK (event_type IN (
      'initiated', 'ringing', 'accepted', 'declined', 'missed',
      'connected', 'reconnecting', 'reconnected', 'ended',
      'canceled', 'failed', 'timeout', 'peer_joined', 'peer_left',
      'media_permission_denied', 'ice_failed', 'quality_degraded'
    )),
  
  event_data JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_events_session ON call_events(call_session_id, created_at);
CREATE INDEX idx_call_events_user ON call_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX idx_call_events_type ON call_events(event_type);

-- Call quality stats (optional)
CREATE TABLE IF NOT EXISTS call_quality_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- WebRTC stats snapshot
  stats_snapshot JSONB NOT NULL,
  
  -- Key metrics
  packet_loss_percent NUMERIC(5,2),
  round_trip_time_ms INTEGER,
  jitter_ms INTEGER,
  bitrate_kbps INTEGER,
  
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_quality_stats_session ON call_quality_stats(call_session_id, collected_at);
