-- =============================================================
-- Backfill marketplace_templates.language from template_config
-- The language column was added after the seed migration, so all
-- 23 mock templates have language = NULL. This breaks the browse
-- filter which defaults to the user's locale.
-- Derives the primary language from template_config.languages[0].
-- =============================================================

UPDATE marketplace_templates
SET language = (template_config->'languages'->>0)
WHERE language IS NULL
  AND template_config->'languages' IS NOT NULL
  AND jsonb_array_length(template_config->'languages') > 0;
