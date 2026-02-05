-- Outputs table for storing generated reports
CREATE TABLE IF NOT EXISTS public.outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
    template_name TEXT NOT NULL, -- Cached template name
    perspective TEXT NOT NULL, -- party_a, party_b, observer
    audience TEXT NOT NULL, -- internal, client, legal, executive
    language TEXT NOT NULL DEFAULT 'en',
    tone TEXT NOT NULL, -- formal, casual, technical
    format TEXT NOT NULL, -- email, report, meeting_notes, action_items
    content TEXT NOT NULL, -- The generated output text
    transcript_version_hash TEXT, -- Hash of transcript used for generation
    cite_timestamps BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outputs_session_id ON public.outputs (session_id);
CREATE INDEX IF NOT EXISTS idx_outputs_template_id ON public.outputs (template_id);
CREATE INDEX IF NOT EXISTS idx_outputs_created_by ON public.outputs (created_by);
CREATE INDEX IF NOT EXISTS idx_outputs_created_at ON public.outputs (created_at DESC);

-- RLS Policies
ALTER TABLE public.outputs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own outputs
CREATE POLICY "Users can view own outputs"
    ON public.outputs FOR SELECT
    USING (created_by = auth.uid());

-- Users can create outputs
CREATE POLICY "Users can create outputs"
    ON public.outputs FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- Users can update their own outputs
CREATE POLICY "Users can update own outputs"
    ON public.outputs FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Users can delete their own outputs
CREATE POLICY "Users can delete own outputs"
    ON public.outputs FOR DELETE
    USING (created_by = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_outputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER outputs_updated_at
    BEFORE UPDATE ON public.outputs
    FOR EACH ROW
    EXECUTE FUNCTION update_outputs_updated_at();

-- Function to increment template usage count when output is created
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.template_id IS NOT NULL THEN
        UPDATE public.templates
        SET used_count = used_count + 1
        WHERE id = NEW.template_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment template usage
CREATE TRIGGER outputs_increment_template_usage
    AFTER INSERT ON public.outputs
    FOR EACH ROW
    EXECUTE FUNCTION increment_template_usage();
