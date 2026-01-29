-- Add structured_context to sessions table
-- Stores AI-parsed context (participants, agenda, meeting type, etc.)

ALTER TABLE sessions
ADD COLUMN structured_context JSONB NULL;

COMMENT ON COLUMN sessions.structured_context IS 'AI-parsed structured context with participants, agenda, meeting_type, etc.';

-- Example structure:
-- {
--   "meeting_type": "Stadtratssitzung",
--   "participants": [
--     {"name": "Matthias Trepper", "role": "Bürgermeister"},
--     {"name": "Hermann Birkenhake", "role": "CDU", "party": "CDU"}
--   ],
--   "agenda": [
--     {"number": "1", "title": "Einwendungen gegen die öffentliche Niederschrift"},
--     {"number": "2", "title": "Anträge auf Änderung der Tagesordnung"}
--   ],
--   "date": "2025-05-16",
--   "location": "Gütersloh",
--   "notes": "Additional context..."
-- }
