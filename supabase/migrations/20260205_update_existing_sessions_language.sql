-- Update all existing sessions to German language
-- Run this AFTER adding the language column

-- Update all sessions that currently have 'en' or NULL to 'de'
UPDATE sessions
SET language = 'de'
WHERE language = 'en' OR language IS NULL;

-- Verify the update
-- SELECT language, COUNT(*) FROM sessions GROUP BY language;
