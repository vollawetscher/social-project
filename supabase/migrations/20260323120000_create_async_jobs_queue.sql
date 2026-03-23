-- Async job queue for durable background processing.
CREATE TABLE IF NOT EXISTS public.async_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'retryable', 'completed', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  idempotency_key TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_async_jobs_status_run_at ON public.async_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_async_jobs_user_created_at ON public.async_jobs(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_async_jobs_idempotency_key ON public.async_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.async_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own async jobs"
  ON public.async_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION update_async_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS async_jobs_updated_at ON public.async_jobs;
CREATE TRIGGER async_jobs_updated_at
  BEFORE UPDATE ON public.async_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_async_jobs_updated_at();

-- Claim queued jobs in a race-safe way.
CREATE OR REPLACE FUNCTION public.claim_async_jobs(
  p_worker_id TEXT,
  p_job_types TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS SETOF public.async_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.async_jobs j
    WHERE j.status IN ('queued', 'retryable')
      AND j.run_at <= NOW()
      AND (p_job_types IS NULL OR j.job_type = ANY(p_job_types))
    ORDER BY j.run_at ASC, j.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 1)
  )
  UPDATE public.async_jobs j
  SET
    status = 'running',
    locked_at = NOW(),
    locked_by = p_worker_id,
    attempt_count = j.attempt_count + 1,
    last_error = NULL,
    updated_at = NOW()
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

