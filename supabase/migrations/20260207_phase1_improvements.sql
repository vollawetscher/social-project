-- Phase 1 Improvements Migration
-- Date: 2026-02-07
-- Purpose: Add user override columns, extended context extraction, and output count support

-- ============================================
-- 1. USER OVERRIDE COLUMNS (for AI suggestions)
-- ============================================

-- Add columns to allow users to override AI suggestions
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS user_recording_type TEXT,
ADD COLUMN IF NOT EXISTS user_domains JSONB,
ADD COLUMN IF NOT EXISTS context_locked BOOLEAN DEFAULT false;

COMMENT ON COLUMN sessions.user_recording_type IS 'User-selected recording type (overrides AI suggestion)';
COMMENT ON COLUMN sessions.user_domains IS 'User-selected domains array (overrides AI suggestion)';
COMMENT ON COLUMN sessions.context_locked IS 'If true, AI analysis will not overwrite user selections';

-- ============================================
-- 2. EXTENDED CONTEXT EXTRACTION FIELDS
-- ============================================

-- Add column to store rich extracted context
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS ai_extracted_context JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN sessions.ai_extracted_context IS 'Rich context extracted by AI: participants, purpose, topics, decisions, action items, etc.';

-- Example structure:
-- {
--   "participants": [
--     {"name": "Dr. Schmidt", "role": "consultant", "confidence": 0.85},
--     {"name": "Frau Meyer", "role": "client", "confidence": 0.90}
--   ],
--   "purpose": "Initial consultation about tax planning",
--   "topics": ["tax optimization", "retirement planning", "investment strategy"],
--   "agenda": ["Review current situation", "Discuss options", "Plan next steps"],
--   "venue": "Office Berlin",
--   "key_dates": ["2026-03-01", "2026-04-15"],
--   "decisions": ["Schedule follow-up", "Request tax documents"],
--   "action_items": [
--     {"task": "Send tax forms", "owner": "Dr. Schmidt", "deadline": "2026-02-15"},
--     {"task": "Gather investment statements", "owner": "Client", "deadline": "2026-02-20"}
--   ],
--   "mood": "professional, collaborative",
--   "outcome": "positive"
-- }

-- ============================================
-- 3. OUTPUT COUNT SUPPORT (via view or query)
-- ============================================

-- Create a view for sessions with output counts (optional, for reporting)
CREATE OR REPLACE VIEW sessions_with_output_count AS
SELECT 
  s.*,
  COUNT(o.id) as output_count
FROM sessions s
LEFT JOIN outputs o ON o.session_id = s.id
GROUP BY s.id;

COMMENT ON VIEW sessions_with_output_count IS 'Sessions with computed output count for quick access';

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================

-- Index for output count queries
CREATE INDEX IF NOT EXISTS idx_outputs_session_id ON outputs(session_id);

-- Index for user override queries
CREATE INDEX IF NOT EXISTS idx_sessions_context_locked ON sessions(context_locked) WHERE context_locked = true;

-- ============================================
-- 5. UPDATE EXISTING SESSIONS
-- ============================================

-- Initialize new columns for existing sessions
UPDATE sessions 
SET 
  context_locked = false,
  ai_extracted_context = '{}'::jsonb
WHERE context_locked IS NULL OR ai_extracted_context IS NULL;

-- ============================================
-- 6. GRANTS (ensure proper RLS)
-- ============================================

-- RLS policies should already cover these new columns via SELECT/UPDATE policies
-- No new policies needed as they're part of the sessions table
