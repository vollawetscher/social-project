-- Shared in-call notes for live collaboration.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS shared_notes text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.calls.shared_notes IS 'Collaborative notes edited during a call by caller/callee.';

