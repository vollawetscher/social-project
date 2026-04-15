-- Add cost tracking to outputs so each generated output carries its LLM cost.
ALTER TABLE public.outputs
  ADD COLUMN IF NOT EXISTS cost_usd numeric;

COMMENT ON COLUMN public.outputs.cost_usd IS
  'Estimated LLM cost in USD for generating this output, computed from token counts at generation time.';

-- Backfill from usage_events where outputId was recorded in metadata.
-- Each output may have one ai_tokens_input and one ai_tokens_output event.
UPDATE public.outputs o
SET cost_usd = sub.total_cost
FROM (
  SELECT
    (ue.metadata ->> 'outputId')::uuid AS output_id,
    SUM(
      CASE ue.event_type
        WHEN 'ai_tokens_input'  THEN ue.amount * 0.000003   -- $3 / 1M tokens
        WHEN 'ai_tokens_output' THEN ue.amount * 0.000015   -- $15 / 1M tokens
        ELSE 0
      END
    ) AS total_cost
  FROM public.usage_events ue
  WHERE ue.event_type IN ('ai_tokens_input', 'ai_tokens_output')
    AND ue.metadata ->> 'outputId' IS NOT NULL
  GROUP BY (ue.metadata ->> 'outputId')::uuid
) sub
WHERE o.id = sub.output_id
  AND o.cost_usd IS NULL;
