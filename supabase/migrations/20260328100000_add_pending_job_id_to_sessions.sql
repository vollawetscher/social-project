-- Session ↔ Queue feedback: tracks the currently pending async job for a session.
-- Set when a job is enqueued, cleared when it completes or fails.
-- Allows cleanup to detect orphaned sessions whose jobs silently died.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS pending_job_id uuid;

-- Index for cleanup queries that scan sessions with a pending job
CREATE INDEX IF NOT EXISTS idx_sessions_pending_job_id
  ON public.sessions (pending_job_id)
  WHERE pending_job_id IS NOT NULL;
