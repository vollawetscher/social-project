-- Reliable aggregated cost view for admin reporting.
-- Pre-aggregates usage per user for all-time, last 30 days, and last 7 days.
-- NOTE: Drop first because the prior usage_costs view has a different column shape.

DROP VIEW IF EXISTS public.usage_costs;

CREATE VIEW public.usage_costs AS
SELECT
  ue.user_id,

  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'transcription_minutes'), 0)::numeric AS transcription_minutes_all,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'ai_tokens_input'), 0)::numeric AS ai_input_tokens_all,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'ai_tokens_output'), 0)::numeric AS ai_output_tokens_all,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'ai_generations'), 0)::numeric AS ai_generations_all,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'email_cost_usd'), 0)::numeric AS email_cost_usd_all,

  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'transcription_minutes' AND ue.created_at >= NOW() - INTERVAL '30 days'), 0)::numeric AS transcription_minutes_30d,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'ai_tokens_input' AND ue.created_at >= NOW() - INTERVAL '30 days'), 0)::numeric AS ai_input_tokens_30d,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'ai_tokens_output' AND ue.created_at >= NOW() - INTERVAL '30 days'), 0)::numeric AS ai_output_tokens_30d,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'ai_generations' AND ue.created_at >= NOW() - INTERVAL '30 days'), 0)::numeric AS ai_generations_30d,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'email_cost_usd' AND ue.created_at >= NOW() - INTERVAL '30 days'), 0)::numeric AS email_cost_usd_30d,

  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'transcription_minutes' AND ue.created_at >= NOW() - INTERVAL '7 days'), 0)::numeric AS transcription_minutes_7d,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'ai_tokens_input' AND ue.created_at >= NOW() - INTERVAL '7 days'), 0)::numeric AS ai_input_tokens_7d,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'ai_tokens_output' AND ue.created_at >= NOW() - INTERVAL '7 days'), 0)::numeric AS ai_output_tokens_7d,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'ai_generations' AND ue.created_at >= NOW() - INTERVAL '7 days'), 0)::numeric AS ai_generations_7d,
  COALESCE(SUM(ue.amount) FILTER (WHERE ue.event_type = 'email_cost_usd' AND ue.created_at >= NOW() - INTERVAL '7 days'), 0)::numeric AS email_cost_usd_7d
FROM public.usage_events ue
GROUP BY ue.user_id;

ALTER VIEW public.usage_costs SET (security_invoker = true);
REVOKE ALL ON TABLE public.usage_costs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.usage_costs TO service_role;

COMMENT ON VIEW public.usage_costs IS
  'Reliable per-user usage aggregates for all-time, last 30 days, and last 7 days used by admin cost reporting.';
