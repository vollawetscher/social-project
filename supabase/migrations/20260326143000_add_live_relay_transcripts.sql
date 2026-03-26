ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS live_track_a_egress_id text,
ADD COLUMN IF NOT EXISTS live_track_b_egress_id text;

CREATE TABLE IF NOT EXISTS public.call_live_transcript_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  speaker_label text NOT NULL,
  text text NOT NULL,
  is_final boolean NOT NULL DEFAULT true,
  timestamp_ms bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_live_transcript_lines_call_idx
  ON public.call_live_transcript_lines(call_id, created_at DESC);

ALTER TABLE public.call_live_transcript_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own live transcript lines" ON public.call_live_transcript_lines;
CREATE POLICY "Users can read own live transcript lines"
  ON public.call_live_transcript_lines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.calls c
      WHERE c.id = call_live_transcript_lines.call_id
        AND c.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.call_live_transcript_lines IS 'Realtime PSTN transcript lines produced by server-side LiveKit-to-Speechmatics relay.';
