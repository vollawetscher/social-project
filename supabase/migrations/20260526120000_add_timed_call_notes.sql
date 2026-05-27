-- Timestamped in-call notes, merged into the post-call transcript.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS timed_call_notes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.calls.timed_call_notes IS
  'Array of { id, text, start_ms, author_name, created_at } — start_ms is ms after call.started_at (recording start).';
