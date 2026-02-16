-- Add input_hint to sessions: user's pre-upload hint about content type
-- Used to tune Speechmatics summarization and analysis (e.g. meeting vs presentation vs voice note)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS input_hint TEXT NULL;

COMMENT ON COLUMN sessions.input_hint IS 'User-selected content hint before upload: meeting, presentation, trade_show, voice_note, etc. Influences summarization and analysis.';
