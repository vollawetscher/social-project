-- Add primary content language column to marketplace_templates (nullable)
-- NULL = universal/untagged template, visible in all language filters
ALTER TABLE marketplace_templates ADD COLUMN IF NOT EXISTS language TEXT DEFAULT NULL;

-- No backfill: existing templates stay NULL (shown in every language filter)
-- New templates get the creator's locale set automatically via the publish API

-- Index for efficient language filtering
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_language ON marketplace_templates(language);

COMMENT ON COLUMN marketplace_templates.language IS 'Primary content language (ISO 639-1). NULL = universal, shown in all filters.';
