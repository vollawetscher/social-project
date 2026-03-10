-- Add language column to templates table (user's local templates)
-- NULL = no language set (universal when published to marketplace)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS language TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_templates_language ON templates(language);

COMMENT ON COLUMN templates.language IS 'Primary content language (ISO 639-1). NULL = not set / universal.';
