-- =============================================================
-- Marketplace Sharing Migration
-- Adds source_template_id to marketplace_templates
-- to link marketplace entries back to personal templates
-- =============================================================

ALTER TABLE marketplace_templates
ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_templates_source
ON marketplace_templates (source_template_id)
WHERE source_template_id IS NOT NULL;

COMMENT ON COLUMN marketplace_templates.source_template_id
IS 'Links to the personal template this was published from. NULL for imported or manually created marketplace templates.';
