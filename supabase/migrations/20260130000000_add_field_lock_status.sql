-- Add lock status columns for transcribable fields
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS context_text_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS private_comments_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS instructions_locked BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN sessions.context_text_locked IS 'Whether the context_text field is locked (finalized)';
COMMENT ON COLUMN sessions.private_comments_locked IS 'Whether the private_comments field is locked (finalized)';
COMMENT ON COLUMN sessions.instructions_locked IS 'Whether the instructions field is locked (finalized)';
