-- Add RLS policy to allow reading session metadata for shared outputs
-- Date: 2026-02-07
-- Purpose: Enable anonymous users to see session info when viewing shared outputs

-- Allow anyone to read basic session info (id, internal_case_id) for sessions
-- that have publicly shared outputs
CREATE POLICY "Anyone can view sessions with public outputs"
    ON public.sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.outputs
            WHERE outputs.session_id = sessions.id
            AND outputs.is_public = true
        )
    );

-- This allows anonymous users to see session metadata
-- but only for sessions that have at least one publicly shared output
