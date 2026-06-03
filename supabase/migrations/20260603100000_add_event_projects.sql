-- Event Projects
--
-- Adds the storage backing three new capabilities layered on top of projects
-- (cases) and sessions:
--   1. cases.event_metadata  — confirmed, web-enriched event identity (venue,
--      dates, official speaker roster, source URL). Free-form JSON, user-confirmable.
--   2. event_digests         — project-level cross-session digest (key takeaways,
--      people met, follow-ups). Case-keyed, mirrors project_pulse_history.
--   3. dismissed_event_suggestions — remembers auto-group cluster suggestions the
--      user dismissed, so the sessions page does not keep nagging.

-- 1. Confirmed event identity on the project.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS event_metadata JSONB;

COMMENT ON COLUMN public.cases.event_metadata IS
  'Confirmed web-enriched event identity for Event projects: { event_name, venue, address, dates, official_speakers[], agenda_url, source_url, confirmed }. Null until enriched + confirmed by the user.';

-- 2. Project-level digest store (one current row per case, history via version).
CREATE TABLE IF NOT EXISTS public.event_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  source_session_ids UUID[] NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_digests_case
  ON public.event_digests(case_id, version DESC);

COMMENT ON TABLE public.event_digests IS
  'Cross-session Event digest (key takeaways, people met, follow-ups) synthesized over a project''s sessions. Newest version per case is the current digest.';

ALTER TABLE public.event_digests ENABLE ROW LEVEL SECURITY;

-- Owner can read digests for their own cases.
CREATE POLICY "Users can read own event digests"
  ON public.event_digests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = event_digests.case_id AND c.user_id = auth.uid()
    )
  );

-- Owner can insert digests for their own cases.
CREATE POLICY "Users can insert own event digests"
  ON public.event_digests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = event_digests.case_id AND c.user_id = auth.uid()
    )
  );

-- Owner can delete digests for their own cases.
CREATE POLICY "Users can delete own event digests"
  ON public.event_digests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = event_digests.case_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all event digests"
  ON public.event_digests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 3. Dismissed auto-group suggestions, keyed by a stable cluster signature.
CREATE TABLE IF NOT EXISTS public.dismissed_event_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, signature)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_event_suggestions_user
  ON public.dismissed_event_suggestions(user_id);

COMMENT ON TABLE public.dismissed_event_suggestions IS
  'Auto-group Event suggestions the user dismissed, keyed by a stable cluster signature (date + sorted member session ids).';

ALTER TABLE public.dismissed_event_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dismissed event suggestions"
  ON public.dismissed_event_suggestions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own dismissed event suggestions"
  ON public.dismissed_event_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own dismissed event suggestions"
  ON public.dismissed_event_suggestions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
