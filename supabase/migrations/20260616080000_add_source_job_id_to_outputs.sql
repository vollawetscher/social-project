-- Add source_job_id to outputs table for idempotent generation.
-- When the async worker calls /api/outputs/generate, it passes the job ID.
-- The unique index ensures that concurrent executions of the same job (caused
-- by proxy retries or worker timeouts) produce at most one output row.
ALTER TABLE public.outputs
  ADD COLUMN IF NOT EXISTS source_job_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outputs_source_job_id
  ON public.outputs (source_job_id)
  WHERE source_job_id IS NOT NULL;
