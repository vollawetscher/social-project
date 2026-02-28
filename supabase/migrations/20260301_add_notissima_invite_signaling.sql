-- Notissima-to-Notissima in-app calling signaling fields and realtime support.

-- Extend call lifecycle for invite-based flows.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS missed_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_mode text,
  ADD COLUMN IF NOT EXISTS callee_declined boolean NOT NULL DEFAULT false;

-- Helpful indexes for invite lookups.
CREATE INDEX IF NOT EXISTS calls_invited_at_idx ON public.calls(invited_at);
CREATE INDEX IF NOT EXISTS calls_accepted_at_idx ON public.calls(accepted_at);
CREATE INDEX IF NOT EXISTS calls_missed_at_idx ON public.calls(missed_at);

-- Allow callees to update their own call row (accept/decline/miss).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calls'
      AND policyname = 'Callee can update own call'
  ) THEN
    CREATE POLICY "Callee can update own call"
      ON public.calls FOR UPDATE
      TO authenticated
      USING (callee_user_id = auth.uid())
      WITH CHECK (callee_user_id = auth.uid());
  END IF;
END $$;

-- Stream signaling rows via Supabase Realtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'consent_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consent_logs;
  END IF;
END $$;
