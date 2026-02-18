-- Create calls table for telephony/video conferencing
-- Links to sessions for transcript + analysis integration

CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  room_name TEXT NOT NULL UNIQUE,
  call_type TEXT NOT NULL DEFAULT 'web',          -- 'web' (both on browser) or 'pstn_outbound' (dial out via Twilio)
  status TEXT NOT NULL DEFAULT 'waiting',          -- waiting, active, ended, processing, transcribing, done, error
  -- Participant info
  participant_a_identity TEXT,                     -- Web user (initiator), display name or user ID
  participant_b_identity TEXT,                     -- Web user or SIP participant
  phone_number TEXT,                               -- For PSTN calls: the dialed number (E.164 format)
  sip_call_id TEXT,                                -- LiveKit SIP participant ID (for PSTN calls)
  -- Timing
  started_at TIMESTAMPTZ,                          -- When the call actually connected
  ended_at TIMESTAMPTZ,                            -- When the call ended
  -- Timestamp alignment fields (atomic timebase for transcript merging)
  room_created_at_ms BIGINT,                       -- Unix ms, the T0 reference point
  track_a_egress_id TEXT,                          -- LiveKit egress ID for participant A's audio track
  track_a_started_at_ns BIGINT,                    -- Unix nanoseconds from LiveKit egress
  track_b_egress_id TEXT,                          -- LiveKit egress ID for participant B's audio track
  track_b_started_at_ns BIGINT,                    -- Unix nanoseconds from LiveKit egress
  -- Metadata
  last_error TEXT,                                 -- Error message if processing failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS calls_user_id_idx ON calls(user_id);
CREATE INDEX IF NOT EXISTS calls_session_id_idx ON calls(session_id);
CREATE INDEX IF NOT EXISTS calls_status_idx ON calls(status);
CREATE INDEX IF NOT EXISTS calls_room_name_idx ON calls(room_name);

-- Row Level Security
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Users can read their own calls
CREATE POLICY "Users can read own calls"
  ON calls FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own calls
CREATE POLICY "Users can insert own calls"
  ON calls FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own calls
CREATE POLICY "Users can update own calls"
  ON calls FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own calls
CREATE POLICY "Users can delete own calls"
  ON calls FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all calls
CREATE POLICY "Admins can read all calls"
  ON calls FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

COMMENT ON TABLE calls IS 'Telephony/video call records linked to sessions for transcript + analysis';
COMMENT ON COLUMN calls.call_type IS 'web = both on browser via LiveKit, pstn_outbound = dial out via Twilio SIP';
COMMENT ON COLUMN calls.room_created_at_ms IS 'Unix ms timestamp when room was created, serves as T0 for transcript alignment';
COMMENT ON COLUMN calls.track_a_started_at_ns IS 'LiveKit egress started_at in Unix nanoseconds, used to compute offset for transcript alignment';
COMMENT ON COLUMN calls.track_b_started_at_ns IS 'LiveKit egress started_at in Unix nanoseconds, used to compute offset for transcript alignment';
