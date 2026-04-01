-- Add meeting_slug to profiles for personal meeting links
-- Each user gets a unique slug like "christian-kruppa" used in notissima.app/meet/{slug}

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meeting_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_meeting_slug_key
  ON profiles (meeting_slug) WHERE meeting_slug IS NOT NULL;

-- Backfill: derive slug from display_name or email prefix
DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  candidate TEXT;
  suffix INT;
BEGIN
  FOR r IN
    SELECT id, display_name, email
    FROM profiles
    WHERE meeting_slug IS NULL
  LOOP
    IF r.display_name IS NOT NULL AND r.display_name <> '' THEN
      base_slug := lower(r.display_name);
    ELSIF r.email IS NOT NULL AND r.email <> '' THEN
      base_slug := lower(split_part(r.email, '@', 1));
    ELSE
      base_slug := substr(r.id::text, 1, 8);
    END IF;

    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');

    IF base_slug = '' THEN
      base_slug := substr(r.id::text, 1, 8);
    END IF;

    candidate := base_slug;
    suffix := 1;

    LOOP
      BEGIN
        UPDATE profiles SET meeting_slug = candidate WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        suffix := suffix + 1;
        candidate := base_slug || '-' || suffix;
      END;
    END LOOP;
  END LOOP;
END $$;
