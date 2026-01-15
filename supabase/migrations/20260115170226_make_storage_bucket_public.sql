/*
  # Make audio storage bucket public

  1. Changes
    - Update rohbericht-audio bucket to be public
    - Add storage policies for public access to upload, read, and delete files
    
  2. Security
    - This allows public access without authentication for MVP testing
    - In production, proper authentication should be re-enabled
*/

UPDATE storage.buckets
SET public = true
WHERE id = 'rohbericht-audio';

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public updates" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own audio files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can read their own audio files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Allow public uploads"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'rohbericht-audio');

CREATE POLICY "Allow public downloads"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'rohbericht-audio');

CREATE POLICY "Allow public deletes"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'rohbericht-audio');

CREATE POLICY "Allow public updates"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'rohbericht-audio')
  WITH CHECK (bucket_id = 'rohbericht-audio');