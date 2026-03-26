CREATE TABLE IF NOT EXISTS public.voice_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL,
  storage_path text NOT NULL,
  duration_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, language)
);

CREATE INDEX IF NOT EXISTS voice_samples_user_idx ON public.voice_samples(user_id);

ALTER TABLE public.voice_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own voice samples"
  ON public.voice_samples
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Migrate existing single voice sample to new table
INSERT INTO public.voice_samples (user_id, language, storage_path, duration_ms, created_at)
SELECT id, 'de', voice_sample_path, voice_sample_duration_ms, now()
FROM public.profiles
WHERE voice_sample_path IS NOT NULL
  AND voice_sample_duration_ms IS NOT NULL
ON CONFLICT (user_id, language) DO NOTHING;

-- Drop old columns from profiles
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS voice_sample_path,
DROP COLUMN IF EXISTS voice_sample_duration_ms;

COMMENT ON TABLE public.voice_samples IS 'Per-language voice samples used to prime Speechmatics speaker diarization.';
