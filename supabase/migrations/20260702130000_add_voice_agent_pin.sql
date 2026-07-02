-- Per-user PIN (hashed) that inbound callers who ARE the account owner must enter
-- (via phone keypad / DTMF) to unlock the assistant's access to their Notissima
-- data during an inbound phone call. Stored as a SHA-256 hash of
-- "<pepper>:<user_id>:<pin>" — never the plaintext PIN.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_agent_pin_hash text;

COMMENT ON COLUMN public.profiles.voice_agent_pin_hash IS
  'SHA-256 hash of the owner''s inbound voice-agent PIN (pepper:user_id:pin). NULL = no PIN set. Never expose to clients.';
