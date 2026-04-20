-- Session collaborators: enables sharing a session with another user.
-- Owner retains full control; collaborators can read the session, its files,
-- its transcript, and can create/read outputs on it.
--
-- Replaces the previous "Prepare Trial" hand-off model (which rewrote
-- sessions.user_id) with a non-destructive share.

CREATE TABLE IF NOT EXISTS public.session_collaborators (
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN ('collaborator', 'viewer')),
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT, -- optional free-form tag, e.g. 'trial'
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS session_collaborators_user_id_idx
  ON public.session_collaborators (user_id);

ALTER TABLE public.session_collaborators ENABLE ROW LEVEL SECURITY;

-- Stable helper: is `p_user_id` a collaborator on `p_session_id`?
-- SECURITY DEFINER so RLS-evaluation on underlying tables doesn't recurse.
CREATE OR REPLACE FUNCTION public.is_session_collaborator(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_collaborators
    WHERE session_id = p_session_id
      AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_session_collaborator(UUID, UUID) TO authenticated;

-- ============================================================================
-- RLS on session_collaborators itself
-- ============================================================================

-- Owner of the session can see who they shared with.
DROP POLICY IF EXISTS "Session owner can read collaborators"
  ON public.session_collaborators;
CREATE POLICY "Session owner can read collaborators"
  ON public.session_collaborators
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_collaborators.session_id
        AND sessions.user_id = auth.uid()
    )
  );

-- Collaborator can see their own share rows (so they can list shared sessions).
DROP POLICY IF EXISTS "Collaborator can read own shares"
  ON public.session_collaborators;
CREATE POLICY "Collaborator can read own shares"
  ON public.session_collaborators
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only the session owner may add/remove collaborators.
DROP POLICY IF EXISTS "Session owner can add collaborators"
  ON public.session_collaborators;
CREATE POLICY "Session owner can add collaborators"
  ON public.session_collaborators
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_collaborators.session_id
        AND sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Session owner can update collaborators"
  ON public.session_collaborators;
CREATE POLICY "Session owner can update collaborators"
  ON public.session_collaborators
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_collaborators.session_id
        AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_collaborators.session_id
        AND sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Session owner can remove collaborators"
  ON public.session_collaborators;
CREATE POLICY "Session owner can remove collaborators"
  ON public.session_collaborators
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_collaborators.session_id
        AND sessions.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Extend SELECT access on sessions, files, transcripts, outputs to collaborators
-- ============================================================================

-- sessions: allow SELECT when caller is a collaborator
DROP POLICY IF EXISTS "Collaborators can read shared sessions"
  ON public.sessions;
CREATE POLICY "Collaborators can read shared sessions"
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (public.is_session_collaborator(id, auth.uid()));

-- sessions: allow UPDATE by collaborators (for cleanup/corrections/etc).
-- Ownership transfer is still blocked at the application layer; at the DB
-- level we refuse UPDATE if user_id would change.
DROP POLICY IF EXISTS "Collaborators can update shared sessions"
  ON public.sessions;
CREATE POLICY "Collaborators can update shared sessions"
  ON public.sessions
  FOR UPDATE
  TO authenticated
  USING (public.is_session_collaborator(id, auth.uid()))
  WITH CHECK (public.is_session_collaborator(id, auth.uid()));

-- files: SELECT for collaborators
DROP POLICY IF EXISTS "Collaborators can read shared files"
  ON public.files;
CREATE POLICY "Collaborators can read shared files"
  ON public.files
  FOR SELECT
  TO authenticated
  USING (public.is_session_collaborator(files.session_id, auth.uid()));

-- transcripts: SELECT for collaborators
DROP POLICY IF EXISTS "Collaborators can read shared transcripts"
  ON public.transcripts;
CREATE POLICY "Collaborators can read shared transcripts"
  ON public.transcripts
  FOR SELECT
  TO authenticated
  USING (public.is_session_collaborator(transcripts.session_id, auth.uid()));

-- outputs: SELECT on any output whose session is accessible to caller
DROP POLICY IF EXISTS "Users can read outputs on accessible sessions"
  ON public.outputs;
CREATE POLICY "Users can read outputs on accessible sessions"
  ON public.outputs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = outputs.session_id
        AND (
          s.user_id = auth.uid()
          OR public.is_session_collaborator(s.id, auth.uid())
        )
    )
  );

-- outputs: INSERT allowed when caller has access to the session
DROP POLICY IF EXISTS "Users can create outputs on accessible sessions"
  ON public.outputs;
CREATE POLICY "Users can create outputs on accessible sessions"
  ON public.outputs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = outputs.session_id
        AND (
          s.user_id = auth.uid()
          OR public.is_session_collaborator(s.id, auth.uid())
        )
    )
  );
