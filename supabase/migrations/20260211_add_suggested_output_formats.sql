-- Add suggested_output_formats to sessions table
-- AI suggests 3 domain-aware output formats after transcript analysis (e.g. sales call → minutes, internal analysis, team update)

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS suggested_output_formats JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN sessions.suggested_output_formats IS 'AI-suggested output formats for this session: [{ title, description, generationInstructions }] - domain-aware (e.g. sales: minutes, internal analysis, team update)';
