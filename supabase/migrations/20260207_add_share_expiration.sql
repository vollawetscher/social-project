-- Add share expiration to outputs
-- Date: 2026-02-07
-- Purpose: Automatically expire shared links after 3 days

-- Add expires_at column
ALTER TABLE outputs 
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN outputs.share_expires_at IS 'When the share link expires (3 days from shared_at)';

-- Function to automatically set expiration when sharing
CREATE OR REPLACE FUNCTION set_share_expiration()
RETURNS TRIGGER AS $$
BEGIN
    -- When is_public is set to true and shared_at is set, calculate expiration
    IF NEW.is_public = true AND NEW.shared_at IS NOT NULL THEN
        NEW.share_expires_at = NEW.shared_at + INTERVAL '3 days';
    END IF;
    
    -- When is_public is set to false, clear expiration
    IF NEW.is_public = false THEN
        NEW.share_expires_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_share_expiration_trigger ON outputs;
CREATE TRIGGER set_share_expiration_trigger
    BEFORE INSERT OR UPDATE ON outputs
    FOR EACH ROW
    EXECUTE FUNCTION set_share_expiration();

-- Update existing shared outputs to have expiration
UPDATE outputs
SET share_expires_at = shared_at + INTERVAL '3 days'
WHERE is_public = true 
  AND shared_at IS NOT NULL 
  AND share_expires_at IS NULL;

-- Update the public view policy to check expiration
DROP POLICY IF EXISTS "Anyone can view publicly shared outputs" ON outputs;
CREATE POLICY "Anyone can view publicly shared outputs"
    ON public.outputs FOR SELECT
    USING (
        is_public = true 
        AND (share_expires_at IS NULL OR share_expires_at > NOW())
    );

COMMENT ON POLICY "Anyone can view publicly shared outputs" ON outputs 
IS 'Allows anonymous access to shared outputs that have not expired (3 days)';
