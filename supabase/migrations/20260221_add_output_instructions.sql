-- Store do/don't instructions on outputs for history recall
ALTER TABLE public.outputs
  ADD COLUMN IF NOT EXISTS do_instructions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS dont_instructions TEXT DEFAULT '';
