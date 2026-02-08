-- Output Sharing Feature Migration
-- Date: 2026-02-07
-- Purpose: Enable public sharing of outputs with unique tokens

-- Add sharing columns to outputs table
ALTER TABLE outputs 
ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shared_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_outputs_share_token ON outputs(share_token) WHERE is_public = true;

-- Create index for view count queries
CREATE INDEX IF NOT EXISTS idx_outputs_view_count ON outputs(view_count) WHERE is_public = true;

-- Comments
COMMENT ON COLUMN outputs.share_token IS 'Unique token for public sharing link';
COMMENT ON COLUMN outputs.is_public IS 'Whether this output is publicly accessible via share link';
COMMENT ON COLUMN outputs.shared_at IS 'Timestamp when output was first shared';
COMMENT ON COLUMN outputs.view_count IS 'Number of times the shared output has been viewed';

-- Initialize share tokens for existing outputs (for future sharing)
UPDATE outputs 
SET share_token = gen_random_uuid() 
WHERE share_token IS NULL;

-- Grant public access to shared outputs (no RLS for public views)
-- We'll handle this in the API layer with token validation
