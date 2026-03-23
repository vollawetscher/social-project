-- Project Pulse fields on cases and optional history table.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS pulse JSONB,
  ADD COLUMN IF NOT EXISTS pulse_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pulse_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.cases.pulse IS 'Project Pulse JSON state (progressive accumulation).';
COMMENT ON COLUMN public.cases.pulse_updated_at IS 'When pulse was last updated by worker.';
COMMENT ON COLUMN public.cases.pulse_version IS 'Current pulse version (worker-managed).';

CREATE TABLE IF NOT EXISTS public.project_pulse_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  pulse JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_history_case
  ON public.project_pulse_history(case_id, version);

