-- Make 'auto' (auto-detect) the default recording language for all users.
-- Speechmatics will detect the actual language and the session is updated post-transcription.

-- 1. Drop the existing constraint that doesn't include 'auto'
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_default_recording_language_check;

-- 2. Recreate with 'auto' included
ALTER TABLE profiles
ADD CONSTRAINT profiles_default_recording_language_check
CHECK (default_recording_language IN ('auto', 'de', 'en', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'cs', 'da', 'fi', 'no', 'sv', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi'));

-- 3. Change column default to 'auto'
ALTER TABLE profiles
ALTER COLUMN default_recording_language SET DEFAULT 'auto';

-- 4. Update all existing users to auto-detect
UPDATE profiles
SET default_recording_language = 'auto'
WHERE default_recording_language IS DISTINCT FROM 'auto';
