-- Add sample_content to templates for View Sample from saved outputs
-- Stores: headings, first sentence per section, short numbered bullet points (1, 2, 3)

ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS sample_content TEXT;

COMMENT ON COLUMN public.templates.sample_content IS 'Shortened sample for View Sample: headings, first sentence per section, numbered bullets. Derived from first output when saving as template.';
