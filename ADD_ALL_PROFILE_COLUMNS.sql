-- Add all missing profile columns for language and workflow preferences
-- Run this in your Supabase SQL Editor

-- Add language preferences columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS default_recording_language TEXT DEFAULT 'de',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Berlin';

-- Add preferred_report_language (check if exists first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'preferred_report_language'
  ) THEN
    ALTER TABLE profiles ADD COLUMN preferred_report_language TEXT DEFAULT 'de';
  END IF;
END $$;

-- Add after_transcript_action preference
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS after_transcript_action TEXT DEFAULT 'nothing';

-- Add comments for documentation
COMMENT ON COLUMN profiles.default_recording_language IS 'Default language for audio transcription (de, en, es, fr, etc.)';
COMMENT ON COLUMN profiles.preferred_report_language IS 'Default language for AI-generated reports';
COMMENT ON COLUMN profiles.timezone IS 'User timezone for timestamp display (IANA timezone format)';
COMMENT ON COLUMN profiles.after_transcript_action IS 'Action to take after transcription completes: nothing, short_summary, long_summary, full_report';

-- Drop existing constraints if they exist and recreate them
DO $$ 
BEGIN
  -- Drop default_recording_language constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_default_recording_language_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_default_recording_language_check;
  END IF;
  
  -- Drop preferred_report_language constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_preferred_report_language_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_preferred_report_language_check;
  END IF;
  
  -- Drop after_transcript_action constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_after_transcript_action_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_after_transcript_action_check;
  END IF;
END $$;

-- Add check constraints for valid values
ALTER TABLE profiles
ADD CONSTRAINT profiles_default_recording_language_check
CHECK (default_recording_language IN ('de', 'en', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'cs', 'da', 'fi', 'no', 'sv', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi'));

ALTER TABLE profiles
ADD CONSTRAINT profiles_preferred_report_language_check
CHECK (preferred_report_language IN ('de', 'en', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'cs', 'da', 'fi', 'no', 'sv', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi'));

ALTER TABLE profiles
ADD CONSTRAINT profiles_after_transcript_action_check
CHECK (after_transcript_action IN ('nothing', 'short_summary', 'long_summary', 'full_report'));

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_default_recording_language ON profiles(default_recording_language);
CREATE INDEX IF NOT EXISTS idx_profiles_after_transcript_action ON profiles(after_transcript_action);

-- Update existing users to have default values
UPDATE profiles 
SET 
  default_recording_language = COALESCE(default_recording_language, 'de'),
  preferred_report_language = COALESCE(preferred_report_language, 'de'),
  timezone = COALESCE(timezone, 'Europe/Berlin'),
  after_transcript_action = COALESCE(after_transcript_action, 'nothing')
WHERE default_recording_language IS NULL 
   OR preferred_report_language IS NULL 
   OR timezone IS NULL 
   OR after_transcript_action IS NULL;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('default_recording_language', 'preferred_report_language', 'timezone', 'after_transcript_action')
ORDER BY column_name;
