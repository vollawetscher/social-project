-- Seed default system templates
-- These are the templates that were previously in mock data, now with real UUIDs

INSERT INTO templates (
  id,
  name,
  description,
  intended_perspectives,
  allowed_audience,
  domain_tags,
  sections,
  required_inputs,
  style_rules,
  suggestion_triggers,
  is_system,
  created_by
) VALUES
  -- Meeting Minutes Template
  (
    gen_random_uuid(),
    'Meeting Minutes',
    'Standard meeting documentation with decisions and action items',
    ARRAY['party_a', 'party_b', 'observer'],
    ARRAY['internal', 'client'],
    ARRAY['general', 'consulting'],
    '[]'::jsonb,
    ARRAY['date', 'attendees', 'topics'],
    ARRAY['professional', 'factual', 'chronological'],
    ARRAY['meeting', 'discussion', 'besluss', 'beslut', 'meeting minutes'],
    true,
    NULL
  ),
  -- Legal Client Summary Template
  (
    gen_random_uuid(),
    'Legal Client Summary',
    'Consultation summary for legal clients with next steps and timelines',
    ARRAY['party_a'],
    ARRAY['client', 'legal'],
    ARRAY['legal'],
    '[]'::jsonb,
    ARRAY['case_number', 'consultation_date'],
    ARRAY['formal', 'precise', 'client-friendly'],
    ARRAY['legal', 'consultation', 'advice', 'case', 'Beratung', 'Mandant'],
    true,
    NULL
  ),
  -- Sales Follow-up Template
  (
    gen_random_uuid(),
    'Sales Follow-up',
    'Post-meeting summary for sales prospects with value proposition',
    ARRAY['party_a'],
    ARRAY['client', 'internal'],
    ARRAY['sales'],
    '[]'::jsonb,
    ARRAY['prospect_name', 'product_discussed'],
    ARRAY['professional', 'persuasive', 'action-oriented'],
    ARRAY['sales', 'call', 'proposal', 'follow-up', 'Verkauf', 'Angebot'],
    true,
    NULL
  ),
  -- Action Items Template
  (
    gen_random_uuid(),
    'Action Items & Next Steps',
    'Extracted action items with owners and deadlines',
    ARRAY['observer'],
    ARRAY['internal'],
    ARRAY['general'],
    '[]'::jsonb,
    ARRAY['meeting_date'],
    ARRAY['bullet-points', 'actionable', 'deadline-focused'],
    ARRAY['todo', 'action', 'task', 'deadline', 'Aufgabe', 'Termin'],
    true,
    NULL
  ),
  -- Executive Summary Template
  (
    gen_random_uuid(),
    'Executive Summary',
    'High-level overview for executives and decision-makers',
    ARRAY['observer'],
    ARRAY['executive'],
    ARRAY['general', 'consulting'],
    '[]'::jsonb,
    ARRAY['meeting_purpose'],
    ARRAY['concise', 'strategic', 'business-focused'],
    ARRAY['executive', 'summary', 'overview', 'strategy', 'Geschäftsführung'],
    true,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Verify templates were inserted
SELECT id, name, is_system FROM templates WHERE is_system = true;
