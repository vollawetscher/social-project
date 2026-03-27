ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS user_is_speaker BOOLEAN;

COMMENT ON COLUMN public.sessions.user_is_speaker IS 'Whether the session owner is a speaker in the recording. Controls voice sample prepend for speaker identification.';
