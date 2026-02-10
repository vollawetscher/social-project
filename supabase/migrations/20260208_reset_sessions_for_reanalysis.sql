-- Reset all existing sessions to force re-analysis with new AI logic
-- This clears old broken participant data and enables fresh analysis

-- Clear old AI analysis data to force re-analysis
UPDATE sessions
SET 
  ai_extracted_context = NULL,
  recording_type = NULL,
  recording_type_confidence = NULL,
  suggested_domains = NULL,
  context_locked = false
WHERE ai_extracted_context IS NOT NULL;

-- Log the number of sessions reset
SELECT 
  COUNT(*) as sessions_reset,
  'Sessions have been reset and will be re-analyzed on next view' as message
FROM sessions
WHERE ai_extracted_context IS NULL;

-- Note: When users open these sessions, AI will automatically re-analyze with:
-- - 2-layer domain detection (Medical → Cardiology)
-- - User identification in participants
-- - Proper participant objects with name/role/isUser
-- - S1, S2, S3 fallback if names can't be detected
