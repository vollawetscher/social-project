-- Support external invite email + one-time guest reminder email tracking.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS guest_invite_email text,
  ADD COLUMN IF NOT EXISTS guest_reminder_email_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS calls_guest_reminder_email_sent_idx
  ON public.calls(guest_reminder_email_sent_at);

COMMENT ON COLUMN public.calls.guest_invite_email
  IS 'Optional guest recipient email used for scheduled invite/reminder delivery.';
COMMENT ON COLUMN public.calls.guest_reminder_email_sent_at
  IS 'Timestamp when one-time guest reminder email was sent for this scheduled call.';

