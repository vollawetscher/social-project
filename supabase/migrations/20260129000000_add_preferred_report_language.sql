-- Add preferred_report_language to sessions table
-- Allows user to override automatic language detection for report generation

ALTER TABLE sessions
ADD COLUMN preferred_report_language TEXT NULL;

COMMENT ON COLUMN sessions.preferred_report_language IS 'User-selected language for report generation (overrides auto-detection). NULL = auto-detect from audio.';

-- Add check constraint for valid language codes
ALTER TABLE sessions
ADD CONSTRAINT sessions_preferred_report_language_check
CHECK (preferred_report_language IS NULL OR preferred_report_language IN ('de', 'en', 'auto'));
