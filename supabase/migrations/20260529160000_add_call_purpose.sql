-- Project Pulse Phase 3: capture user-declared purpose at call creation time.
--
-- The purpose is set on the calls row at planning time (e.g. "Initial vendor
-- demo with Acme") and is later propagated by the webhook onto the session
-- row that gets created when the call records, with purpose_source = 'user'.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS purpose TEXT;

COMMENT ON COLUMN public.calls.purpose IS
  'User-declared purpose for this call. Propagated to sessions.purpose with purpose_source = ''user'' when the call session is created by the webhook.';
