-- =============================================================
-- Seed data for Voice2Value Marketplace
-- Run after 20260309_add_marketplace.sql
-- =============================================================

-- Seed Categories
INSERT INTO marketplace_categories (name, slug, icon, sort_order) VALUES
  ('Psychology', 'psychology', '🧠', 1),
  ('Medical', 'medical', '🏥', 2),
  ('Sales', 'sales', '💼', 3),
  ('Legal', 'legal', '⚖️', 4),
  ('Education', 'education', '🎓', 5),
  ('IT & Support', 'it-support', '💻', 6),
  ('Consulting', 'consulting', '📊', 7),
  ('HR', 'hr', '👥', 8),
  ('General', 'general', '📝', 9)
ON CONFLICT (slug) DO NOTHING;

-- Seed 10 Starter Templates (using a system user approach)
-- These will be seeded when an admin publishes them, or can be inserted manually.
-- Below is a template-ready format that Christian can adapt with the correct author_id.

-- Example: Insert with a specific author_id (replace <ADMIN_USER_ID> with an actual user UUID)
-- INSERT INTO marketplace_templates (author_id, title, description, instructions, template_config, category_id, tags, is_published) VALUES
-- (
--   '<ADMIN_USER_ID>',
--   'Therapy Session Notes',
--   'Structured clinical notes from therapy sessions following SOAP format with observations and treatment plan.',
--   'Create structured therapy session notes from this conversation...',
--   '{"perspectives":["observer"],"audiences":["internal"],"tone":"formal","output_format":"markdown","languages":["en","de"],"domains":["psychology"],"generation_prompt":"Create structured therapy session notes...","do_include":"","do_not_include":""}'::jsonb,
--   (SELECT id FROM marketplace_categories WHERE slug = 'psychology'),
--   ARRAY['therapy', 'clinical', 'SOAP'],
--   true
-- );
