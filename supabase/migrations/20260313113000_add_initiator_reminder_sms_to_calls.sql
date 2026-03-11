-- Track one-time initiator reminder SMS send state.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS initiator_reminder_sms_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS calls_initiator_reminder_sms_idx
  ON public.calls(initiator_reminder_sms_sent_at);

COMMENT ON COLUMN public.calls.initiator_reminder_sms_sent_at
  IS 'Timestamp when an initiator self-reminder SMS was sent for this scheduled call.';

