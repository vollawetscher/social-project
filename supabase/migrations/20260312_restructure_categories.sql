-- =============================================================
-- Restructure marketplace categories
-- Psychology -> Medical, IT & Support -> Technical, add Business
-- =============================================================

-- 1. Add new "Business" category
INSERT INTO marketplace_categories (name, slug, icon, sort_order)
VALUES ('Business', 'business', '🏢', 1)
ON CONFLICT (slug) DO NOTHING;

-- 2. Add new "Technical" category
INSERT INTO marketplace_categories (name, slug, icon, sort_order)
VALUES ('Technical', 'technical', '🔧', 4)
ON CONFLICT (slug) DO NOTHING;

-- 3. Move templates from "Psychology" to "Medical"
UPDATE marketplace_templates
SET category_id = (SELECT id FROM marketplace_categories WHERE slug = 'medical')
WHERE category_id = (SELECT id FROM marketplace_categories WHERE slug = 'psychology');

-- 4. Move templates from "IT & Support" to "Technical"
UPDATE marketplace_templates
SET category_id = (SELECT id FROM marketplace_categories WHERE slug = 'technical')
WHERE category_id = (SELECT id FROM marketplace_categories WHERE slug = 'it-support');

-- 5. Delete old categories
DELETE FROM marketplace_categories WHERE slug = 'psychology';
DELETE FROM marketplace_categories WHERE slug = 'it-support';

-- 6. Update sort_order for clean ordering
UPDATE marketplace_categories SET sort_order = 1 WHERE slug = 'business';
UPDATE marketplace_categories SET sort_order = 2 WHERE slug = 'legal';
UPDATE marketplace_categories SET sort_order = 3 WHERE slug = 'medical';
UPDATE marketplace_categories SET sort_order = 4 WHERE slug = 'technical';
UPDATE marketplace_categories SET sort_order = 5 WHERE slug = 'education';
UPDATE marketplace_categories SET sort_order = 6 WHERE slug = 'sales';
UPDATE marketplace_categories SET sort_order = 7 WHERE slug = 'consulting';
UPDATE marketplace_categories SET sort_order = 8 WHERE slug = 'hr';
UPDATE marketplace_categories SET sort_order = 9 WHERE slug = 'general';
