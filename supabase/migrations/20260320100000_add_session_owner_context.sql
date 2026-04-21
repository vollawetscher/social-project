-- Session owner context + clarification state.
--
-- `owner_context` stores a structured answer to "who are you in this
-- conversation?" so downstream prompts (analyze, generate, translate)
-- can tailor suggestions and outputs to the session owner's role.
--
-- `pending_clarification` stores an LLM-emitted question + options when
-- the analyzer couldn't confidently infer the owner's role. The UI renders
-- a small inline prompt and POSTs the answer to
-- /api/sessions/[id]/owner-context, which persists the answer, clears
-- this field, and re-runs analyze with the new context.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS owner_context JSONB,
  ADD COLUMN IF NOT EXISTS pending_clarification JSONB;

COMMENT ON COLUMN public.sessions.owner_context IS
  'Structured context about the session owner''s role in the recorded '
  'conversation. Shape: { role: string, speakerId?: string, goal?: string, '
  'counterpartyRole?: string, source: "user" | "inferred" }.';

COMMENT ON COLUMN public.sessions.pending_clarification IS
  'LLM-emitted question to disambiguate owner role before producing '
  'suggestions. Shape: { question: string, options: [{id,label}], '
  'allowFreeText: boolean, createdAt: timestamptz }.';
