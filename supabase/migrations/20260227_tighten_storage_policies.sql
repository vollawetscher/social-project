-- Tighten storage RLS policies: require authentication for all writes
-- Previously, public role had full INSERT/UPDATE/DELETE access to the bucket

-- Drop wide-open public write policies
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;

-- Drop user-folder-scoped policies (never matched actual storage paths)
DROP POLICY IF EXISTS "Users can upload audio files to own folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio files" ON storage.objects;

-- Authenticated-only write policies
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rohbericht-audio');

CREATE POLICY "Authenticated users can update audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'rohbericht-audio')
WITH CHECK (bucket_id = 'rohbericht-audio');

CREATE POLICY "Authenticated users can delete audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rohbericht-audio');

-- Keep existing:
-- "Allow public downloads" (public SELECT) — needed for audio playback via public URLs
-- "Users can read own audio files" (authenticated SELECT) — harmless, more restrictive than public
