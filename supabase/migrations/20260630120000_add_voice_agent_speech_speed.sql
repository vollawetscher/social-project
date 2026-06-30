-- Per-user speech speed for the in-call voice assistant (Cartesia sonic-3: 0.6–2.0).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_agent_speech_speed real NOT NULL DEFAULT 1.0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_voice_agent_speech_speed_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_voice_agent_speech_speed_check
      CHECK (voice_agent_speech_speed >= 0.6 AND voice_agent_speech_speed <= 2.0);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.voice_agent_speech_speed IS
  'Speaking speed for the in-call voice assistant (Cartesia sonic-3, 0.6–2.0, 1.0 = normal).';
