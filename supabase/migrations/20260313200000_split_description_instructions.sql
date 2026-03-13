-- =============================================================
-- Migration: Split description and instructions fields
-- Date: 2026-03-13
-- Safe to run multiple times (idempotent)
--
-- WHAT THIS DOES:
-- Previously, templates.description contained the AI generation prompt.
-- Now we separate them:
--   description  = short user-friendly summary (shown publicly)
--   instructions = AI generation prompt (never shown publicly)
--
-- This migration copies prompts from description -> instructions
-- and then clears description so users can enter a proper summary.
-- =============================================================

-- Step 0: Ensure the instructions column exists
-- (should already exist from 20260208_add_template_instructions.sql,
--  but this makes the migration fully standalone)
ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS instructions TEXT;

-- Step 1: Copy description -> instructions for templates where instructions
-- is NULL, empty, or only contains the auto-generated default text.
-- This preserves the AI prompt that was previously stored in description.
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

-- Step 2: Clear description for non-system user templates.
-- The old description content IS the prompt, not a real description,
-- so we clear it. Users will fill in a proper description later.
-- System templates keep their descriptions (they may already be correct).
UPDATE public.templates
SET description = ''
WHERE is_system = false
AND description IS NOT NULL
AND description != ''
AND instructions IS NOT NULL
AND instructions != '';
