-- Track PSTN consent progress so initiators can see real-time status updates.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS pstn_consent_state text NOT NULL DEFAULT 'not_required';

-- Backfill existing PSTN calls to a sensible default where state is unknown.
UPDATE public.calls
SET pstn_consent_state = 'not_required'
WHERE pstn_consent_state IS NULL;

COMMENT ON COLUMN public.calls.pstn_consent_state IS
  'PSTN consent flow state: not_required | pending | granted | declined | timeout';
