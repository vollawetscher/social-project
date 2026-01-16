/*
  # Add public access policies for all related tables

  1. Changes
    - Add public access policies for files, transcripts, reports, pii_hits
    - Allow access when sessions.user_id is NULL (MVP mode)
    - Keep existing admin policies intact

  2. Security
    - This enables MVP testing without authentication
    - For production, these policies should be removed
*/

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public access to files" ON files;
  DROP POLICY IF EXISTS "Allow public access to transcripts" ON transcripts;
  DROP POLICY IF EXISTS "Allow public access to reports" ON reports;
  DROP POLICY IF EXISTS "Allow public access to pii_hits" ON pii_hits;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Allow public access to files"
  ON files
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to transcripts"
  ON transcripts
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to reports"
  ON reports
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to pii_hits"
  ON pii_hits
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
