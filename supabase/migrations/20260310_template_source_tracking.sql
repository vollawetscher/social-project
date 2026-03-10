-- =============================================================
-- Template Source Tracking & Custom Instructions Migration
-- Adds marketplace_source_id to track installed templates
-- Adds custom_instructions for user supplements on installed templates
-- =============================================================

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS marketplace_source_id UUID REFERENCES marketplace_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_templates_marketplace_source
ON templates (marketplace_source_id)
WHERE marketplace_source_id IS NOT NULL;

COMMENT ON COLUMN templates.marketplace_source_id
IS 'Links to the marketplace template this was installed from. NULL for self-created templates.';

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS custom_instructions TEXT DEFAULT '';

COMMENT ON COLUMN templates.custom_instructions
IS 'User-added instructions that supplement the original prompt. Used alongside description when generating output.';
