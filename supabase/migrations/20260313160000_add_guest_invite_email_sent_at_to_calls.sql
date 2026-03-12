ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS guest_invite_email_sent_at timestamptz;

COMMENT ON COLUMN public.calls.guest_invite_email_sent_at
  IS 'Timestamp when the initial invite email was sent to the guest at call creation.';
