-- Curated voice selection for the in-call voice assistant.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_agent_voice_id text NOT NULL DEFAULT '38aabb6a-f52b-4fb0-a3d1-988518f4dc06';

COMMENT ON COLUMN public.profiles.voice_agent_voice_id IS
  'Curated LiveKit Inference / Cartesia voice id used by the in-call voice assistant.';
