-- Voice agent settings on user profiles (single deployable agent, per-user runtime config)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_agent_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_agent_display_name text NOT NULL DEFAULT 'Frau Peters',
  ADD COLUMN IF NOT EXISTS voice_agent_wake_word text NOT NULL DEFAULT 'Frau Peters',
  ADD COLUMN IF NOT EXISTS voice_agent_wake_sounds_like text[] NOT NULL DEFAULT ARRAY['Frau Peters', 'Peters', 'frau peters'],
  ADD COLUMN IF NOT EXISTS voice_agent_dismiss_phrase text NOT NULL DEFAULT 'Danke, Frau Peters',
  ADD COLUMN IF NOT EXISTS voice_agent_ack_phrases text[] NOT NULL DEFAULT ARRAY['Gerne!', 'Bitte sehr.', 'Gern geschehen.'],
  ADD COLUMN IF NOT EXISTS voice_agent_language text;

COMMENT ON COLUMN public.profiles.voice_agent_enabled IS 'When true, the LiveKit voice agent joins this user''s calls (no batch audio recording).';
COMMENT ON COLUMN public.profiles.voice_agent_wake_word IS 'Free-text wake phrase; matched on owner audio only.';
COMMENT ON COLUMN public.profiles.voice_agent_wake_sounds_like IS 'Speechmatics additional_vocab sounds_like hints for the wake word.';
COMMENT ON COLUMN public.profiles.voice_agent_dismiss_phrase IS 'Owner-only phrase that returns the agent to sleep.';
COMMENT ON COLUMN public.profiles.voice_agent_ack_phrases IS 'Random spoken acknowledgements after dismiss.';
COMMENT ON COLUMN public.profiles.voice_agent_language IS 'Optional override; defaults to default_recording_language when null.';
