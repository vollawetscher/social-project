-- Add 4 missing marketplace categories to match the 13 domain tags in code
-- (psychology was deleted in 20260312, it-support was deleted and replaced by technical,
--  meetings and support never existed)

INSERT INTO marketplace_categories (name, slug, icon, sort_order)
VALUES
  ('Psychology', 'psychology', '🧠', 10),
  ('IT', 'it', '💻', 11),
  ('Meetings', 'meetings', '📅', 12),
  ('Support', 'support', '🎧', 13)
ON CONFLICT (slug) DO NOTHING;
