-- Dynamic token budget configuration for AI routes.

CREATE TABLE IF NOT EXISTS public.ai_token_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task TEXT NOT NULL,
  model TEXT NULL,
  template_id UUID NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  min_tokens INTEGER NOT NULL DEFAULT 256,
  max_tokens INTEGER NOT NULL DEFAULT 4096,
  scaling_factor NUMERIC(10,4) NOT NULL DEFAULT 1.0000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_token_budgets_min_positive CHECK (min_tokens > 0),
  CONSTRAINT ai_token_budgets_max_positive CHECK (max_tokens > 0),
  CONSTRAINT ai_token_budgets_bounds CHECK (max_tokens >= min_tokens),
  CONSTRAINT ai_token_budgets_scaling_positive CHECK (scaling_factor > 0)
);

CREATE INDEX IF NOT EXISTS idx_ai_token_budgets_lookup
  ON public.ai_token_budgets(task, is_active, model, template_id);

CREATE OR REPLACE FUNCTION public.update_ai_token_budgets_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_token_budgets_updated_at ON public.ai_token_budgets;
CREATE TRIGGER trg_ai_token_budgets_updated_at
BEFORE UPDATE ON public.ai_token_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_token_budgets_updated_at();

ALTER TABLE public.ai_token_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage ai_token_budgets"
  ON public.ai_token_budgets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.ai_token_budgets IS
  'Dynamic token budget policies per task/model/template for AI request max_tokens resolution.';
