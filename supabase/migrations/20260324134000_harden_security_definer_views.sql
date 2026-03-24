-- Harden advisory-flagged views by enforcing caller context and least-privilege grants.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'sessions_with_output_count'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.sessions_with_output_count SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON TABLE public.sessions_with_output_count FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.sessions_with_output_count TO service_role';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'usage_costs'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.usage_costs SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON TABLE public.usage_costs FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.usage_costs TO service_role';
  END IF;
END $$;
