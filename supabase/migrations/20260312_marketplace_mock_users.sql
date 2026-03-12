-- =============================================================
-- Create mock marketplace users and distribute templates
-- Creates 8 fictional author profiles so the marketplace
-- looks like it has a diverse creator community.
-- =============================================================

DO $$
DECLARE
  -- English-focused authors
  v_sarah    UUID := 'a1000001-0000-0000-0000-000000000001';
  v_james    UUID := 'a1000001-0000-0000-0000-000000000002';
  v_rachel   UUID := 'a1000001-0000-0000-0000-000000000003';
  v_david    UUID := 'a1000001-0000-0000-0000-000000000004';
  -- German-focused authors
  v_thomas   UUID := 'a1000001-0000-0000-0000-000000000005';
  v_anna     UUID := 'a1000001-0000-0000-0000-000000000006';
  v_markus   UUID := 'a1000001-0000-0000-0000-000000000007';
  v_elena    UUID := 'a1000001-0000-0000-0000-000000000008';

  v_fake_pw  TEXT := '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
BEGIN

  -- ============ 1. Create auth.users entries ============
  -- These are non-loginable mock accounts (fake password hash).

  INSERT INTO auth.users (id, instance_id, email, encrypted_password, role, aud, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_sarah,  '00000000-0000-0000-0000-000000000000', 'sarah.mitchell@notissima-demo.local',  v_fake_pw, 'authenticated', 'authenticated', now(), '2026-01-10T10:00:00Z', now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_james,  '00000000-0000-0000-0000-000000000000', 'james.chen@notissima-demo.local',      v_fake_pw, 'authenticated', 'authenticated', now(), '2026-01-08T14:00:00Z', now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_rachel, '00000000-0000-0000-0000-000000000000', 'rachel.torres@notissima-demo.local',   v_fake_pw, 'authenticated', 'authenticated', now(), '2026-01-12T09:00:00Z', now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_david,  '00000000-0000-0000-0000-000000000000', 'david.nakamura@notissima-demo.local',  v_fake_pw, 'authenticated', 'authenticated', now(), '2026-01-15T11:00:00Z', now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_thomas, '00000000-0000-0000-0000-000000000000', 'thomas.weber@notissima-demo.local',    v_fake_pw, 'authenticated', 'authenticated', now(), '2026-01-06T08:00:00Z', now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_anna,   '00000000-0000-0000-0000-000000000000', 'anna.bergmann@notissima-demo.local',   v_fake_pw, 'authenticated', 'authenticated', now(), '2026-01-09T16:00:00Z', now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_markus, '00000000-0000-0000-0000-000000000000', 'markus.hoffmann@notissima-demo.local', v_fake_pw, 'authenticated', 'authenticated', now(), '2026-01-11T13:00:00Z', now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_elena,  '00000000-0000-0000-0000-000000000000', 'elena.richter@notissima-demo.local',   v_fake_pw, 'authenticated', 'authenticated', now(), '2026-01-07T10:00:00Z', now(), '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- ============ 2. Create profile entries ============

  INSERT INTO profiles (id, email, role, display_name, marketplace_username, marketplace_bio, created_at)
  VALUES
    (v_sarah,  'sarah.mitchell@notissima-demo.local',  'user', 'Sarah Mitchell',         'sarahmitchell',  'Sales enablement consultant. Helping teams close more deals with better documentation.', '2026-01-10T10:00:00Z'),
    (v_james,  'james.chen@notissima-demo.local',      'user', 'Dr. James Chen',         'drjameschen',    'Clinical educator and family physician. Building better documentation workflows for healthcare.', '2026-01-08T14:00:00Z'),
    (v_rachel, 'rachel.torres@notissima-demo.local',   'user', 'Rachel Torres',          'racheltorres',   'Operations manager specializing in team productivity and meeting efficiency.', '2026-01-12T09:00:00Z'),
    (v_david,  'david.nakamura@notissima-demo.local',  'user', 'David Nakamura',         'davidnakamura',  'Management consultant and former corporate lawyer. Templates for high-stakes conversations.', '2026-01-15T11:00:00Z'),
    (v_thomas, 'thomas.weber@notissima-demo.local',    'user', 'Dr. Thomas Weber',       'drtweber',       'Klinischer Psychologe und Psychotherapeut. Analytische Vorlagen fuer tiefere Gespraechsauswertung.', '2026-01-06T08:00:00Z'),
    (v_anna,   'anna.bergmann@notissima-demo.local',   'user', 'Anna Bergmann',          'annabergmann',   'Heilpraktikerin und klassische Homoeopathin. Praxisvorlagen fuer ganzheitliche Behandlungsdokumentation.', '2026-01-09T16:00:00Z'),
    (v_markus, 'markus.hoffmann@notissima-demo.local', 'user', 'Markus Hoffmann',        'markushoffmann', 'Kreativstratege und Kommunikationsberater. Unkonventionelle Analyse-Perspektiven.', '2026-01-11T13:00:00Z'),
    (v_elena,  'elena.richter@notissima-demo.local',   'user', 'Prof. Dr. Elena Richter','elenarichter',   'Professorin fuer Unternehmensstrategie. Frameworks fuer strukturierte Entscheidungsfindung.', '2026-01-07T10:00:00Z')
  ON CONFLICT (id) DO NOTHING;

  -- ============ 3. Reassign templates to mock authors ============
  -- Match by title since we don't have stable IDs from the seed migration.

  -- Sarah Mitchell: Sales templates (EN)
  UPDATE marketplace_templates SET author_id = v_sarah  WHERE title = 'Sales Call Summary';
  UPDATE marketplace_templates SET author_id = v_sarah  WHERE title = 'Customer Onboarding Call';

  -- Dr. James Chen: Medical & Education (EN)
  UPDATE marketplace_templates SET author_id = v_james  WHERE title = 'Lecture Notes Generator';
  UPDATE marketplace_templates SET author_id = v_james  WHERE title = 'Therapy Session Notes';
  UPDATE marketplace_templates SET author_id = v_james  WHERE title = 'Medical Consultation Report';

  -- Rachel Torres: General, HR, IT (EN)
  UPDATE marketplace_templates SET author_id = v_rachel WHERE title = 'Team Meeting Minutes';
  UPDATE marketplace_templates SET author_id = v_rachel WHERE title = 'HR Interview Assessment';
  UPDATE marketplace_templates SET author_id = v_rachel WHERE title = 'IT Support Ticket';

  -- David Nakamura: Consulting & Legal (EN)
  UPDATE marketplace_templates SET author_id = v_david  WHERE title = 'Consulting Strategy Brief';
  UPDATE marketplace_templates SET author_id = v_david  WHERE title = 'Legal Deposition Summary';

  -- Dr. Thomas Weber: Psychology templates (DE)
  UPDATE marketplace_templates SET author_id = v_thomas WHERE title = 'Psychoanalyse nach Sigmund Freud';
  UPDATE marketplace_templates SET author_id = v_thomas WHERE title = 'Humanistische Analyse nach Carl Rogers';
  UPDATE marketplace_templates SET author_id = v_thomas WHERE title = 'Behavioristische Analyse nach B.F. Skinner';

  -- Anna Bergmann: Homeopathy templates (DE)
  UPDATE marketplace_templates SET author_id = v_anna   WHERE title = 'Homoeopathie nach Hahnemann';
  UPDATE marketplace_templates SET author_id = v_anna   WHERE title LIKE 'Homoeopathie nach George Vithoulkas%';
  UPDATE marketplace_templates SET author_id = v_anna   WHERE title = 'Homoeopathie nach James Tyler Kent';
  UPDATE marketplace_templates SET author_id = v_anna   WHERE title LIKE 'Homoeopathie Meta-Analyse%';

  -- Markus Hoffmann: Creative/General (DE)
  UPDATE marketplace_templates SET author_id = v_markus WHERE title = 'Sarkastische Analyse';
  UPDATE marketplace_templates SET author_id = v_markus WHERE title LIKE 'Progressive Inklusions-Analyse%';
  UPDATE marketplace_templates SET author_id = v_markus WHERE title = 'Systemkritische Truther-Analyse';

  -- Prof. Dr. Elena Richter: Business/Strategy (DE)
  UPDATE marketplace_templates SET author_id = v_elena  WHERE title = 'Steve Jobs Product Vision Analysis';
  UPDATE marketplace_templates SET author_id = v_elena  WHERE title = 'Elon Musk First Principles Analysis';
  UPDATE marketplace_templates SET author_id = v_elena  WHERE title = 'Warren Buffett Investment Analysis';

  -- ============ 4. Reassign community posts to varied authors ============

  UPDATE community_posts SET author_id = v_sarah  WHERE title = 'How I Built a MEDDIC Template That Closed 3 Deals';
  UPDATE community_posts SET author_id = v_james  WHERE title LIKE 'Best practice for therapy notes%';
  UPDATE community_posts SET author_id = v_rachel WHERE title = 'Pro tip: Use Observer perspective for meeting summaries';
  UPDATE community_posts SET author_id = v_rachel WHERE title = 'How to handle multiple languages in a single session?';
  UPDATE community_posts SET author_id = v_david  WHERE title = 'Building the Perfect Legal Deposition Template';
  UPDATE community_posts SET author_id = v_sarah  WHERE title LIKE 'Add "Highlight areas of disagreement"%';

  RAISE NOTICE 'Created 8 mock users and reassigned 23 templates + 6 community posts';
END $$;
