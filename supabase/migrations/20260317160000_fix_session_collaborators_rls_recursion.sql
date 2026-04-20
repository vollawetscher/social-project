-- Fix: circular RLS dependency between sessions and session_collaborators.
--
-- The previous migration added policies on `session_collaborators` that
-- reference `sessions.user_id`, AND policies on `sessions` that call
-- `is_session_collaborator()` (which queries `session_collaborators`).
-- Postgres then evaluates each policy against the other, causing recursion
-- and GET /api/sessions to return 500.
--
-- Fix: session_collaborators RLS becomes "you can read your own share rows"
-- only. All owner-side operations (list who you shared with, add, remove)
-- go through the API with the service role (already the case in
-- app/api/sessions/[id]/collaborators and app/api/admin/prepare-trial).

DROP POLICY IF EXISTS "Session owner can read collaborators"
  ON public.session_collaborators;
DROP POLICY IF EXISTS "Session owner can add collaborators"
  ON public.session_collaborators;
DROP POLICY IF EXISTS "Session owner can update collaborators"
  ON public.session_collaborators;
DROP POLICY IF EXISTS "Session owner can remove collaborators"
  ON public.session_collaborators;

-- Keep only the collaborator self-read policy ("Collaborator can read own
-- shares") from the previous migration; no action needed if it's still
-- there, but we recreate it defensively to ensure it exists.
DROP POLICY IF EXISTS "Collaborator can read own shares"
  ON public.session_collaborators;
CREATE POLICY "Collaborator can read own shares"
  ON public.session_collaborators
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Make the helper function resilient even if row_security somehow applies.
-- SECURITY DEFINER + explicit search_path is already set; add a
-- SET row_security = off guard to be safe.
CREATE OR REPLACE FUNCTION public.is_session_collaborator(
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
    SELECT 1 FROM public.session_collaborators
    WHERE session_id = p_session_id
      AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_session_collaborator(UUID, UUID) TO authenticated;
