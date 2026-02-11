-- Usage events for beta cost tracking and subscription modeling
-- Tracks: transcription minutes, AI tokens, and other billable usage

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  amount NUMERIC(14, 4) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'count',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event types:
-- transcription_minutes (amount = minutes, unit = 'minutes')
-- ai_tokens_input (amount = token count, unit = 'tokens')
-- ai_tokens_output (amount = token count, unit = 'tokens')
-- ai_generations (amount = 1, unit = 'count') - simple count of AI calls

CREATE INDEX idx_usage_events_user_created ON usage_events(user_id, created_at DESC);
CREATE INDEX idx_usage_events_type_created ON usage_events(event_type, created_at DESC);
CREATE INDEX idx_usage_events_user_type_month ON usage_events(user_id, event_type, (date_trunc('month', created_at)));

COMMENT ON TABLE usage_events IS 'Beta: Usage tracking for transcription minutes and AI tokens. Used for cost calculation and subscription modeling.';

-- RLS: Only backend (service role) or authenticated users inserting for themselves
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS
-- Authenticated users can insert their own usage (user_id must match auth.uid())
CREATE POLICY "Users can insert own usage" ON usage_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own usage for dashboards
CREATE POLICY "Users can read own usage" ON usage_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
