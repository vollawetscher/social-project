-- Add recorded_at to sessions: date/time from audio file metadata (e.g. file.lastModified)
-- Used for display in Context tab when available
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN sessions.recorded_at IS 'Date/time from audio file metadata when available (file.lastModified or embedded metadata). NULL if not set.';
