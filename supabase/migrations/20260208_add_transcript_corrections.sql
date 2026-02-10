-- Add transcript corrections/aliases to sessions table
-- Used for both name corrections AND PII redaction

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS transcript_corrections JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN sessions.transcript_corrections IS 'Mapping of corrections to apply to transcript display: {"original": "replacement", "Hazard": "Azat", "555-1234": "[PHONE_1]"}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_transcript_corrections 
ON sessions USING GIN (transcript_corrections);

-- Example structure:
-- {
--   "name_corrections": {
--     "Hazard": "Azat",
--     "Dr. Shmidt": "Dr. Schmidt"
--   },
--   "pii_redactions": {
--     "John Smith": "[NAME_1]",
--     "555-123-4567": "[PHONE_1]",
--     "john@email.com": "[EMAIL_1]"
--   }
-- }

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sessions' AND column_name = 'transcript_corrections';
