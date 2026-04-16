-- Recover stale job locks before claiming new work.
-- Jobs locked for >5 minutes are assumed to be from dead workers
-- (e.g. killed by a deploy) and are reset to 'retryable'.
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
  -- Phase 1: Recover stale locks from dead workers.
  UPDATE public.async_jobs
  SET
    status = 'retryable',
    locked_at = NULL,
    locked_by = NULL,
    last_error = 'Stale lock recovered (worker likely killed by deploy)',
    updated_at = NOW()
  WHERE status = 'running'
    AND locked_at < NOW() - INTERVAL '5 minutes';

  -- Phase 2: Claim available jobs.
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
