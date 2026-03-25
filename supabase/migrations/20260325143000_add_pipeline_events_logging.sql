-- Structured observability for session processing pipeline.

CREATE TABLE IF NOT EXISTS public.pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stage TEXT NOT NULL,
  event TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_session_created
  ON public.pipeline_events(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_stage_created
  ON public.pipeline_events(stage, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_user_created
  ON public.pipeline_events(user_id, created_at DESC);

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; app logging uses service role.
CREATE POLICY "Service role can manage pipeline_events"
  ON public.pipeline_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.pipeline_events IS
  'Structured processing timeline for session pipeline stages (transcribe, analyze, outputs, pulse).';
