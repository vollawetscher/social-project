-- Lightweight app presence tracking for call reachability preflight.

CREATE TABLE IF NOT EXISTS public.call_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  app_state TEXT NOT NULL DEFAULT 'foreground',
  last_route TEXT,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_presence_last_heartbeat_at
  ON public.call_presence(last_heartbeat_at DESC);

ALTER TABLE public.call_presence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'call_presence'
      AND policyname = 'Users can read own call presence'
  ) THEN
    CREATE POLICY "Users can read own call presence"
      ON public.call_presence FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'call_presence'
      AND policyname = 'Users can upsert own call presence'
  ) THEN
    CREATE POLICY "Users can upsert own call presence"
      ON public.call_presence FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'call_presence'
      AND policyname = 'Users can update own call presence'
  ) THEN
    CREATE POLICY "Users can update own call presence"
      ON public.call_presence FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_call_presence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_presence_touch_updated_at ON public.call_presence;
CREATE TRIGGER trg_call_presence_touch_updated_at
BEFORE UPDATE ON public.call_presence
FOR EACH ROW
EXECUTE FUNCTION public.touch_call_presence_updated_at();
