/*
  # Create Audio Storage Bucket

  1. Storage Bucket
    - `rohbericht-audio` bucket for storing audio files
    - Private bucket (not publicly accessible)
    - File size limit: 100MB per file
    - Allowed MIME types: audio/mpeg, audio/wav, audio/mp4, audio/m4a, audio/x-m4a

  2. Storage Policies
    - Users can upload files to their own session folders
    - Users can read files from their own session folders
    - Admins can access all files
    - File paths: {user_id}/{session_id}/{filename}

  3. Security
    - All access requires authentication
    - Files are stored with user_id prefix for isolation
    - RLS enforced via storage policies
*/

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rohbericht-audio',
  'rohbericht-audio',
  false,
  104857600, -- 100MB
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mp3', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio files
CREATE POLICY "Users can upload audio files to own folders"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'rohbericht-audio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own audio files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'rohbericht-audio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own audio files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'rohbericht-audio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'rohbericht-audio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own audio files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'rohbericht-audio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can access all audio files"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'rohbericht-audio' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'rohbericht-audio' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
