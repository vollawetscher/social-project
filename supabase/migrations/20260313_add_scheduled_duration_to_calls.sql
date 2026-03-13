-- Store planned duration (minutes) for scheduled calls.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS scheduled_duration_min integer;

-- Backfill existing scheduled calls to default 30 minutes.
UPDATE public.calls
SET scheduled_duration_min = 30
WHERE status = 'scheduled' AND (scheduled_duration_min IS NULL OR scheduled_duration_min <= 0);

COMMENT ON COLUMN public.calls.scheduled_duration_min IS
  'Planned duration in minutes for scheduled calls (used for invites/calendar).';
