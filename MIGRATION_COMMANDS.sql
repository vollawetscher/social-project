-- ========================================
-- REQUIRED MIGRATIONS FOR AI SUGGESTIONS
-- Run these in Supabase SQL Editor
-- ========================================

-- 1. Add language column to sessions (if not exists)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'de';

COMMENT ON COLUMN sessions.language IS 'Language code for transcription (en, de, es, fr, etc.)';

CREATE INDEX IF NOT EXISTS idx_sessions_language ON sessions(language);

-- 2. Add AI analysis fields to sessions (CRITICAL for suggestions)
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS recording_type TEXT,
ADD COLUMN IF NOT EXISTS recording_type_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS suggested_domains JSONB DEFAULT '[]'::jsonb;

-- Create index for filtering by recording type
CREATE INDEX IF NOT EXISTS idx_sessions_recording_type ON sessions(recording_type);

-- Comment the columns
COMMENT ON COLUMN sessions.recording_type IS 'AI-detected type: meeting, interview, presentation, consultation, lecture, other';
COMMENT ON COLUMN sessions.recording_type_confidence IS 'Confidence score (0.00 to 1.00) for recording type detection';
COMMENT ON COLUMN sessions.suggested_domains IS 'AI-suggested domains with confidence scores: [{"domain": "legal", "confidence": 0.85}]';

-- 3. Add audio_url to sessions (for audio playback)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS audio_url TEXT;

COMMENT ON COLUMN sessions.audio_url IS 'Public URL to the audio file in Supabase Storage';

-- 4. Add missing files table columns (for upload workflow)
ALTER TABLE files
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'pending';

COMMENT ON COLUMN files.original_filename IS 'Original filename from user upload';
COMMENT ON COLUMN files.upload_status IS 'Status of the upload (pending, uploading, completed, failed)';

CREATE INDEX IF NOT EXISTS idx_files_upload_status ON files(upload_status);

-- 5. Fix RLS policies for sessions (if needed)
-- Only run if you're getting permission errors
DROP POLICY IF EXISTS "Allow public access to sessions" ON sessions;

-- Ensure authenticated users can access their own sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sessions'
    AND policyname = 'Users can insert own sessions'
  ) THEN
    CREATE POLICY "Users can insert own sessions"
      ON sessions FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sessions'
    AND policyname = 'Users can update own sessions'
  ) THEN
    CREATE POLICY "Users can update own sessions"
      ON sessions FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sessions'
    AND policyname = 'Users can read own sessions'
  ) THEN
    CREATE POLICY "Users can read own sessions"
      ON sessions FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 6. Update existing sessions to German (optional)
-- Only run if you want to change all existing sessions from English to German
UPDATE sessions 
SET language = 'de' 
WHERE language = 'en' OR language IS NULL;

-- 7. Verify everything is set up correctly
SELECT 
  'sessions.language' as column_check,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' AND column_name = 'language'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
UNION ALL
SELECT 
  'sessions.recording_type',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' AND column_name = 'recording_type'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END
UNION ALL
SELECT 
  'sessions.suggested_domains',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' AND column_name = 'suggested_domains'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END
UNION ALL
SELECT 
  'sessions.audio_url',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' AND column_name = 'audio_url'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END
UNION ALL
SELECT 
  'files.original_filename',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'original_filename'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END;

-- Expected output: All rows should show "✓ EXISTS"
