-- Add user preferences to profiles table
-- These settings control what happens after transcription completes

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS auto_generate_reports boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;

-- Comment explaining the preferences
COMMENT ON COLUMN profiles.auto_generate_reports IS 'If true, automatically generate reports after transcribing meeting recordings';
COMMENT ON COLUMN profiles.preferences IS 'Additional user preferences in JSON format for future extensibility';

-- Index for faster preference queries
CREATE INDEX IF NOT EXISTS profiles_auto_generate_reports_idx ON profiles(auto_generate_reports);
