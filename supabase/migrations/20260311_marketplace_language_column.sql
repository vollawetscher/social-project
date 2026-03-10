-- Add primary content language column to marketplace_templates
ALTER TABLE marketplace_templates ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Backfill existing templates to 'de' (most existing content is German)
UPDATE marketplace_templates
SET language = 'de'
WHERE language = 'en' OR language IS NULL;

-- Index for efficient language filtering
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_language ON marketplace_templates(language);

COMMENT ON COLUMN marketplace_templates.language IS 'Primary content language of the template (ISO 639-1 code)';
