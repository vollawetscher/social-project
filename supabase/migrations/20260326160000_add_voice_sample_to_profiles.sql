ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS voice_sample_path text,
ADD COLUMN IF NOT EXISTS voice_sample_duration_ms integer;

COMMENT ON COLUMN public.profiles.voice_sample_path IS 'Storage path in rohbericht-audio bucket for the user voice sample used to prime speaker diarization.';
COMMENT ON COLUMN public.profiles.voice_sample_duration_ms IS 'Duration of the voice sample in milliseconds, used to offset transcript timestamps.';
