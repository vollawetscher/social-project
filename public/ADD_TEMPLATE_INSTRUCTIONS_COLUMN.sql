-- Quick migration to add instructions column to templates
-- Run this in Supabase SQL Editor if the migration file hasn't been run yet

ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS instructions TEXT;

COMMENT ON COLUMN public.templates.instructions IS 'Detailed instructions for AI to generate outputs using this template';

-- Update existing templates with basic instructions
UPDATE public.templates
SET instructions = COALESCE(
  instructions, 
  'Generate a ' || name || ' document following the defined structure and style rules.'
)
WHERE instructions IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'templates' AND column_name = 'instructions';
