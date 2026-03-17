-- Add output_format to templates to support email-only templates
ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS output_format TEXT NOT NULL DEFAULT 'markdown';

COMMENT ON COLUMN public.templates.output_format IS 'Template output mode: markdown, json, or email_text (plain text email only)';
