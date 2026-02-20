-- Callee onboarding: when a guest accepts a video call they receive a 5-day trial
-- and get their own forked session with the transcript.

-- 1. Trial expiry on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_expires_at TIMESTAMPTZ;

-- 2. Callee tracking on calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS callee_user_id UUID REFERENCES auth.users(id);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS callee_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- 3. Pending flag on sessions: true while the callee session is waiting for
--    the caller's transcript to finish copying.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_callee_pending BOOLEAN NOT NULL DEFAULT false;

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS calls_callee_user_id_idx ON calls(callee_user_id);
CREATE INDEX IF NOT EXISTS calls_callee_session_id_idx ON calls(callee_session_id);

-- 5. RLS: allow callee to read their own claimed call row
--    (needed so the sessions API can look up callee_session_ids)
CREATE POLICY "Callee can read own call"
  ON calls FOR SELECT
  TO authenticated
  USING (callee_user_id = auth.uid());
