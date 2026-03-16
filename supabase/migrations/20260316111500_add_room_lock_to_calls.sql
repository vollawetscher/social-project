ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS room_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.calls.room_locked IS
  'When true, joining is restricted by host moderation controls.';
