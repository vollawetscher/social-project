-- Reset a session's status to allow report generation retry
-- Replace the session ID below with your actual session ID if different

-- Reset to 'done' status (transcription complete, ready for report)
UPDATE sessions
SET 
  status = 'done',
  last_error = NULL
WHERE id = '4e60d7c0-e59f-4831-a50c-2eb90270eee4';

-- To check the current status:
SELECT id, status, last_error, created_at
FROM sessions 
WHERE id = '4e60d7c0-e59f-4831-a50c-2eb90270eee4';

-- Or to see all your recent error sessions:
-- SELECT id, status, last_error, created_at 
-- FROM sessions 
-- WHERE status = 'error' 
-- ORDER BY created_at DESC 
-- LIMIT 5;
