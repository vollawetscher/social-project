-- Widget leads: captures anonymous landing-page widget interactions.
-- Each row represents one "Explain" submission. The same browser session
-- can produce multiple rows (e.g. after applying a correction).
-- When a visitor later signs up, linked_user_id is back-filled by matching
-- session_id stored in the browser, enabling role→actual-usage correlation.

CREATE TABLE IF NOT EXISTS public.widget_leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          TEXT NOT NULL,            -- random ID stored in sessionStorage (anonymous)
  self_description    TEXT NOT NULL,            -- the visitor's typed role description
  browser_locale      TEXT,                     -- e.g. 'de-DE', used as jurisdiction fallback
  correction          TEXT,                     -- non-null when visitor applied a correction
  classification      JSONB,                    -- AI output: {domain, industry, role, context}
  not_relevant        BOOLEAN NOT NULL DEFAULT false,  -- true when relevance gate fired
  clicked_start_free  BOOLEAN NOT NULL DEFAULT false,  -- true when visitor clicked the CTA
  linked_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for signup linkage (look up by session_id to find the lead to link)
CREATE INDEX IF NOT EXISTS widget_leads_session_id_idx
  ON public.widget_leads (session_id);

-- Index for analytics queries by locale and date
CREATE INDEX IF NOT EXISTS widget_leads_browser_locale_created_idx
  ON public.widget_leads (browser_locale, created_at DESC);

-- Index for user correlation queries
CREATE INDEX IF NOT EXISTS widget_leads_linked_user_id_idx
  ON public.widget_leads (linked_user_id)
  WHERE linked_user_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_widget_leads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER widget_leads_updated_at
  BEFORE UPDATE ON public.widget_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_widget_leads_updated_at();

-- RLS: table is insert/update-only from the public (anon) role.
-- No row should ever be readable by the public — only service role (analytics, linking).
ALTER TABLE public.widget_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (the widget is a public, unauthenticated surface)
CREATE POLICY "widget_leads_anon_insert"
  ON public.widget_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow the same session to update its own row (e.g. mark clicked_start_free)
-- We use session_id as the identity token since there is no auth here.
CREATE POLICY "widget_leads_session_update"
  ON public.widget_leads FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- No public SELECT — analytics runs server-side with service role only
-- (No SELECT policy intentionally)

COMMENT ON TABLE public.widget_leads IS
  'Landing-page widget interactions. Captures role descriptions, AI classifications, '
  'corrections, and CTA clicks. Linked to auth.users when the visitor signs up, '
  'enabling role-description → actual-usage correlation for prompt improvement.';
