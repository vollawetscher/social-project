-- Add transcribable text fields to sessions table
-- These fields can be filled via live transcription or manual text entry

ALTER TABLE sessions
ADD COLUMN context_text TEXT NULL,
ADD COLUMN private_comments TEXT NULL,
ADD COLUMN instructions TEXT NULL;

COMMENT ON COLUMN sessions.context_text IS 'Transcribable/editable context information (participants, agenda, etc.)';
COMMENT ON COLUMN sessions.private_comments IS 'Transcribable/editable private notes (not included in report)';
COMMENT ON COLUMN sessions.instructions IS 'Transcribable/editable instructions for report generation';

-- context_note kept for backward compatibility and will be deprecated later
