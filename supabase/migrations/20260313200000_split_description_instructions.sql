-- Migration: Split description and instructions fields
-- Previously, templates.description was used as the AI generation prompt.
-- Now: description = user-friendly summary, instructions = AI generation prompt.

-- Step 1: Copy description -> instructions for templates where instructions
-- is NULL, empty, or contains the generic default text
UPDATE public.templates
SET instructions = description
WHERE (
  instructions IS NULL
  OR instructions = ''
  OR instructions LIKE 'Generate a % following the defined structure and style.'
  OR instructions LIKE 'Generate a % document following the defined structure and style rules.'
)
AND description IS NOT NULL
AND description != '';

-- Step 2: Clear description for non-system user templates
-- (since the old description IS the prompt, not a real description)
-- System templates keep their descriptions as-is since they may have proper ones
UPDATE public.templates
SET description = ''
WHERE is_system = false
AND description IS NOT NULL
AND description != ''
AND instructions IS NOT NULL
AND instructions != '';
