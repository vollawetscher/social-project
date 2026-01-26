-- Add unique constraint on session_id in reports table
-- This ensures only one report per session and enables proper upsert behavior

-- First, delete duplicate reports, keeping only the most recent one for each session
DELETE FROM reports r1
WHERE EXISTS (
  SELECT 1 FROM reports r2
  WHERE r2.session_id = r1.session_id
  AND r2.created_at > r1.created_at
);

-- Now add the unique constraint
ALTER TABLE reports
ADD CONSTRAINT reports_session_id_unique UNIQUE (session_id);
