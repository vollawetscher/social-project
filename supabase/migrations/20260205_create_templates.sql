-- Templates table for storing report templates
CREATE TABLE IF NOT EXISTS public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    intended_perspectives TEXT[] DEFAULT '{}', -- party_a, party_b, observer
    allowed_audience TEXT[] DEFAULT '{}', -- internal, client, legal, executive
    domain_tags TEXT[] DEFAULT '{}', -- sales, support, legal, hr, etc
    used_count INTEGER DEFAULT 0,
    sections JSONB DEFAULT '[]', -- Array of TemplateSection objects
    required_inputs TEXT[] DEFAULT '{}',
    style_rules TEXT[] DEFAULT '{}',
    suggestion_triggers TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT false, -- System templates vs user-created
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_templates_domain_tags ON public.templates USING GIN (domain_tags);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON public.templates (created_by);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON public.templates (is_system);

-- RLS Policies
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Users can view all templates (system + their own)
CREATE POLICY "Users can view all templates"
    ON public.templates FOR SELECT
    USING (is_system = true OR created_by = auth.uid());

-- Users can create their own templates
CREATE POLICY "Users can create templates"
    ON public.templates FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
    ON public.templates FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
    ON public.templates FOR DELETE
    USING (created_by = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER templates_updated_at
    BEFORE UPDATE ON public.templates
    FOR EACH ROW
    EXECUTE FUNCTION update_templates_updated_at();

-- Insert some default system templates
INSERT INTO public.templates (name, description, intended_perspectives, allowed_audience, domain_tags, sections, required_inputs, style_rules, suggestion_triggers, is_system) VALUES
(
    'Meeting Summary',
    'Comprehensive summary of meeting discussions, decisions, and action items',
    ARRAY['observer'],
    ARRAY['internal', 'client'],
    ARRAY['meetings', 'general'],
    '[
        {"id": "1", "name": "Overview", "description": "High-level summary of the meeting", "isRequired": true},
        {"id": "2", "name": "Key Discussions", "description": "Main topics discussed", "isRequired": true},
        {"id": "3", "name": "Decisions Made", "description": "Important decisions reached", "isRequired": true},
        {"id": "4", "name": "Action Items", "description": "Follow-up tasks and responsibilities", "isRequired": true}
    ]'::jsonb,
    ARRAY['meeting date', 'participants', 'main topics'],
    ARRAY['Be concise and factual', 'Use bullet points for clarity', 'Highlight key decisions'],
    ARRAY['meeting', 'discussion', 'decision'],
    true
),
(
    'Sales Call Report',
    'Detailed report of sales conversation including needs analysis and next steps',
    ARRAY['party_a', 'observer'],
    ARRAY['internal', 'executive'],
    ARRAY['sales', 'business'],
    '[
        {"id": "1", "name": "Call Overview", "description": "Basic information about the call", "isRequired": true},
        {"id": "2", "name": "Customer Needs", "description": "Identified customer needs and pain points", "isRequired": true},
        {"id": "3", "name": "Product Discussion", "description": "Products/services discussed", "isRequired": true},
        {"id": "4", "name": "Objections", "description": "Any concerns or objections raised", "isRequired": false},
        {"id": "5", "name": "Next Steps", "description": "Follow-up actions and timeline", "isRequired": true}
    ]'::jsonb,
    ARRAY['customer name', 'products discussed'],
    ARRAY['Focus on value proposition', 'Include specific quotes', 'Note competitor mentions'],
    ARRAY['sales', 'customer', 'product', 'deal'],
    true
),
(
    'Support Case Summary',
    'Technical support case documentation including issue resolution',
    ARRAY['party_a', 'observer'],
    ARRAY['internal', 'client'],
    ARRAY['support', 'technical'],
    '[
        {"id": "1", "name": "Issue Description", "description": "Customer-reported problem", "isRequired": true},
        {"id": "2", "name": "Troubleshooting Steps", "description": "Actions taken to diagnose", "isRequired": true},
        {"id": "3", "name": "Resolution", "description": "How the issue was resolved", "isRequired": true},
        {"id": "4", "name": "Follow-up Required", "description": "Any additional steps needed", "isRequired": false}
    ]'::jsonb,
    ARRAY['customer name', 'issue type', 'priority'],
    ARRAY['Include error messages verbatim', 'Document exact steps taken', 'Note system details'],
    ARRAY['support', 'issue', 'technical', 'problem'],
    true
);
