-- Fix: infinite recursion in policy for relation "outputs".
--
-- The sessions table has an existing policy ("Anyone can view sessions with
-- public outputs", from 20260207_add_sessions_public_read_policy.sql) that
-- EXISTS-queries `outputs`. The shared-sessions migration added an `outputs`
-- policy that EXISTS-queries `sessions`. Postgres evaluates each policy
-- against the other, which is infinite recursion:
--
--   outputs RLS -> SELECT from sessions -> sessions RLS -> SELECT from outputs -> ...
--
-- Fix: replace the EXISTS-on-sessions in the outputs policies with a
-- SECURITY DEFINER helper that has `row_security = off`, so RLS is not
-- re-entered when it checks session access.

CREATE OR REPLACE FUNCTION public.user_can_access_session(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = p_session_id
      AND (
        s.user_id = p_user_id
        OR EXISTS (
          SELECT 1
          FROM public.session_collaborators sc
          WHERE sc.session_id = s.id
            AND sc.user_id = p_user_id
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_session(UUID, UUID) TO authenticated;

-- Replace the recursive policies on outputs.
DROP POLICY IF EXISTS "Users can read outputs on accessible sessions"
  ON public.outputs;
CREATE POLICY "Users can read outputs on accessible sessions"
  ON public.outputs
  FOR SELECT
  TO authenticated
  USING (public.user_can_access_session(session_id, auth.uid()));

DROP POLICY IF EXISTS "Users can create outputs on accessible sessions"
  ON public.outputs;
CREATE POLICY "Users can create outputs on accessible sessions"
  ON public.outputs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.user_can_access_session(session_id, auth.uid())
  );
