-- Add language column to sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'de';

COMMENT ON COLUMN sessions.language IS 'Language code for transcription (en, de, es, fr, etc.)';

-- Create index for faster filtering by language
CREATE INDEX IF NOT EXISTS idx_sessions_language ON sessions(language);
