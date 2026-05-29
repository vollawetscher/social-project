-- Project Pulse Phase 1: typed projects.
-- Adds AI-classified project_type and user_role to cases. Free-text fields,
-- written by the analyze pipeline as suggestions and confirmed/edited by the
-- user when creating a project from a session. No enum, no template lookup —
-- the LLM produces type-aware content downstream.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS project_type TEXT,
  ADD COLUMN IF NOT EXISTS user_role TEXT;

COMMENT ON COLUMN public.cases.project_type IS
  'AI-classified project type, free-text (e.g. "New Hire (employer side)", "Account Sale (seller side)"). User-confirmable.';
COMMENT ON COLUMN public.cases.user_role IS
  'User''s role in this project, free-text (e.g. "Hiring manager", "Investment club host"). User-confirmable.';
