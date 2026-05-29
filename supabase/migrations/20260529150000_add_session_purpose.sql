-- Project Pulse Phase 3: user-set session purpose.
--
-- `sessions.purpose` is the user-declared answer to "what is this conversation for".
-- When set with `purpose_source = 'user'` it is canonical: the analyze pipeline
-- treats it as ground truth for intent and does NOT flag drift between declared
-- purpose and what was actually discussed. When the user does not provide a
-- purpose, the analyze pipeline back-fills the AI-extracted purpose into this
-- column with `purpose_source = 'ai'`, so downstream consumers (Pulse, search,
-- listings) can read one place.
--
-- `cases.default_session_purpose` is an optional default that auto-applies to
-- spontaneous sessions attached to a project when the user does not provide one.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS purpose_source TEXT;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS default_session_purpose TEXT;

COMMENT ON COLUMN public.sessions.purpose IS
  'User-declared session purpose, when provided. Canonical when set; falls back to ai_extracted_context.purpose otherwise.';
COMMENT ON COLUMN public.sessions.purpose_source IS
  'Origin of sessions.purpose: ''user'' (typed by the owner), ''ai'' (back-filled from analyze when no user value), or null.';
COMMENT ON COLUMN public.cases.default_session_purpose IS
  'Optional default purpose applied to spontaneous sessions attached to this project, when the user does not provide one.';

-- Optional sanity constraint: only the two known sources are allowed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_purpose_source_check'
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_purpose_source_check
      CHECK (purpose_source IS NULL OR purpose_source IN ('user', 'ai'));
  END IF;
END
$$;
