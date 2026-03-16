-- Fix marketplace_downloads: add UNIQUE constraint, DELETE RLS policy,
-- and update download_count trigger to also fire on DELETE.

-- 1. Deduplicate any existing rows before adding UNIQUE constraint
DELETE FROM marketplace_downloads a
USING marketplace_downloads b
WHERE a.id > b.id
  AND a.template_id = b.template_id
  AND a.user_id = b.user_id;

-- 2. Add UNIQUE constraint so each user can only have one download record per template
ALTER TABLE marketplace_downloads
ADD CONSTRAINT marketplace_downloads_template_user_unique
UNIQUE (template_id, user_id);

-- 3. Allow users to delete their own download records (needed for reinstall flow)
CREATE POLICY "Users can delete own downloads"
ON marketplace_downloads FOR DELETE
USING (user_id = auth.uid());

-- 4. Replace download_count trigger function to handle both INSERT and DELETE
CREATE OR REPLACE FUNCTION update_marketplace_template_download_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_templates
  SET download_count = (
    SELECT COUNT(*)
    FROM marketplace_downloads
    WHERE template_id = COALESCE(NEW.template_id, OLD.template_id)
  )
  WHERE id = COALESCE(NEW.template_id, OLD.template_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Recreate trigger to fire on INSERT and DELETE
DROP TRIGGER IF EXISTS trg_marketplace_download_count ON marketplace_downloads;

CREATE TRIGGER trg_marketplace_download_count
  AFTER INSERT OR DELETE ON marketplace_downloads
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_template_download_count();
