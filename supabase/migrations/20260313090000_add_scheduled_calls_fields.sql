-- Add scheduled-call support to calls table.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_timezone text;

CREATE INDEX IF NOT EXISTS calls_scheduled_for_idx ON public.calls(scheduled_for);
CREATE INDEX IF NOT EXISTS calls_callee_scheduled_for_idx ON public.calls(callee_user_id, scheduled_for DESC);

COMMENT ON COLUMN public.calls.scheduled_for IS 'UTC timestamp for planned call start.';
COMMENT ON COLUMN public.calls.scheduled_timezone IS 'IANA timezone selected by the organizer when scheduling.';

