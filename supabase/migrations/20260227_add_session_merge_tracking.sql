-- Track source sessions that were merged into another session.
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS merged_into_session_id uuid NULL REFERENCES public.sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_merged_into_session_id
  ON public.sessions(merged_into_session_id);
