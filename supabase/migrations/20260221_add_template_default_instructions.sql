-- Add default do/don't instruction fields to templates
-- These pre-fill the generation modal when a template is selected
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS default_do_instructions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_dont_instructions TEXT DEFAULT '';
