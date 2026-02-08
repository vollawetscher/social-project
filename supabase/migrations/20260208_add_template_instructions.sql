-- Add instructions column to templates table
-- This stores AI-generated or user-provided template generation instructions

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
