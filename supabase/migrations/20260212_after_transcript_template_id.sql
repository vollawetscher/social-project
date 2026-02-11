-- Add after_transcript_template_id to profiles
-- User selects a template for auto-generation after transcription (instead of hardcoded short_summary/long_summary/full_report)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS after_transcript_template_id UUID REFERENCES templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN profiles.after_transcript_template_id IS 'Template to use for auto-generation after transcription. NULL = do nothing. User can select any template (system or own).';

CREATE INDEX IF NOT EXISTS idx_profiles_after_transcript_template 
ON profiles(after_transcript_template_id) 
WHERE after_transcript_template_id IS NOT NULL;
