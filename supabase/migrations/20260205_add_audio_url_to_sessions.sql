-- Add audio_url field to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Comment the column
COMMENT ON COLUMN sessions.audio_url IS 'URL to the audio file in Supabase Storage or external location';
