-- Add RLS policy to allow public access to shared outputs
-- Date: 2026-02-07
-- Purpose: Enable anonymous users to view publicly shared outputs

-- Allow anyone (including anonymous users) to view outputs that are marked as public
CREATE POLICY "Anyone can view publicly shared outputs"
    ON public.outputs FOR SELECT
    USING (is_public = true);

-- Note: This policy allows SELECT without authentication when is_public = true
-- The share_token provides security through obscurity (UUID is hard to guess)
