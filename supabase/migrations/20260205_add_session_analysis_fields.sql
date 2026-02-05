-- Add fields for AI-powered session analysis
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS recording_type TEXT,
ADD COLUMN IF NOT EXISTS recording_type_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS suggested_domains JSONB DEFAULT '[]'::jsonb;

-- Create index for filtering by recording type
CREATE INDEX IF NOT EXISTS idx_sessions_recording_type ON sessions(recording_type);

-- Comment the columns
COMMENT ON COLUMN sessions.recording_type IS 'AI-detected type: meeting, interview, presentation, consultation, lecture, other';
COMMENT ON COLUMN sessions.recording_type_confidence IS 'Confidence score (0.00 to 1.00) for recording type detection';
COMMENT ON COLUMN sessions.suggested_domains IS 'AI-suggested domains with confidence scores: [{"domain": "legal", "confidence": 0.85}]';
