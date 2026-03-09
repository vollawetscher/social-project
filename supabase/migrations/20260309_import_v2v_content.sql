-- =============================================================
-- Import V2V Templates + Community Posts into Notissima
-- Run AFTER 20260309_add_marketplace.sql + 20260309_seed_marketplace.sql
-- =============================================================

-- Use the first admin user as the author for imported content.
-- If no admin exists, falls back to the first user in profiles.
DO $$
DECLARE
  v_author UUID;
BEGIN
  SELECT id INTO v_author FROM profiles WHERE role = 'admin' LIMIT 1;
  IF v_author IS NULL THEN
    SELECT id INTO v_author FROM profiles ORDER BY created_at LIMIT 1;
  END IF;

  IF v_author IS NULL THEN
    RAISE EXCEPTION 'No user found in profiles — create at least one user first';
  END IF;

  -- ============ TEMPLATES ============

  INSERT INTO marketplace_templates (author_id, title, description, instructions, template_config, category_id, tags, download_count, avg_rating, is_published, created_at) VALUES

  -- 1. Team Meeting Minutes (General, 534 downloads)
  (v_author, 'Team Meeting Minutes',
   'Clean, actionable meeting minutes with decisions, action items, and ownership clearly documented.',
   'Generate clean meeting minutes from the team discussion.',
   '{"tone":"neutral","domains":["meetings","general"],"audiences":["internal"],"languages":["en","de"],"do_include":"Attendee list\nDecisions made (with who decided)\nAction items with owner + deadline\nNext meeting date if mentioned","perspectives":["observer"],"output_format":"markdown","do_not_include":"Sidebar conversations\nJokes and social banter\nRedundant back-and-forth discussions","generation_prompt":"Generate clean meeting minutes from this team discussion. Include attendees, agenda items discussed, decisions made, action items with owners and deadlines, and open issues carried forward. Keep it concise and scannable."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'general'),
   ARRAY['meetings','minutes','action-items','team'], 534, 4.30, true, '2026-01-24T00:59:23Z'),

  -- 2. Sales Call Summary (Sales, 518 downloads)
  (v_author, 'Sales Call Summary',
   'Convert sales calls into actionable summaries with next steps, objections, and deal status.',
   'Create a concise sales call summary with prospect needs and next steps.',
   '{"tone":"direct","domains":["sales","business"],"audiences":["internal","executive"],"languages":["en"],"do_include":"Deal value and stage\nKey objections and how they were addressed\nNext steps with owner and deadline\nCompetitor mentions","perspectives":["party_a","party_b"],"output_format":"markdown","do_not_include":"Smalltalk and pleasantries\nInternal pricing discussions","generation_prompt":"Create a concise sales call summary. Identify the prospect, their needs, objections raised, commitments made, and clear next steps with deadlines."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'sales'),
   ARRAY['sales','crm','follow-up'], 518, 4.60, true, '2026-01-22T00:59:23Z'),

  -- 3. Lecture Notes Generator (Education, 423 downloads)
  (v_author, 'Lecture Notes Generator',
   'Transform academic lectures into well-organized study notes with key concepts and references.',
   'Transform lecture recording into comprehensive study notes.',
   '{"tone":"neutral","domains":["education"],"audiences":["internal"],"languages":["en"],"do_include":"Key concepts and definitions\nExam hints or emphasized topics\nReading assignments and references","perspectives":["observer"],"output_format":"markdown","do_not_include":"Administrative announcements\nOff-topic student questions","generation_prompt":"Transform this lecture recording into comprehensive study notes. Organize by topics, highlight key concepts, include definitions, and note any references to readings or assignments."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'education'),
   ARRAY['education','lecture','study-notes'], 423, 4.50, true, '2026-02-06T00:59:23Z'),

  -- 4. Therapy Session Notes (Psychology, 342 downloads)
  (v_author, 'Therapy Session Notes',
   'Structured notes for psychology therapy sessions with patient insights and treatment plans.',
   'Generate structured therapy session notes from the transcription.',
   '{"tone":"formal","domains":["psychology"],"audiences":["internal"],"languages":["en"],"do_include":"Patient mood and emotional state\nKey therapeutic insights\nHomework and action items\nTherapeutic techniques applied","perspectives":["observer"],"output_format":"markdown","do_not_include":"Patient full name or identifying details\nTherapist personal opinions outside clinical context","generation_prompt":"Generate structured therapy session notes from the transcription. Include patient mood assessment, key topics discussed, therapeutic techniques used, homework assigned, and next session goals."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'psychology'),
   ARRAY['therapy','mental-health','patient-notes'], 342, 4.80, true, '2026-01-17T00:59:23Z'),

  -- 5. Customer Onboarding Call (Sales, 291 downloads)
  (v_author, 'Customer Onboarding Call',
   'Structured onboarding summaries to ensure smooth handoff from sales to customer success.',
   'Create a structured onboarding summary from the kickoff call.',
   '{"tone":"direct","domains":["sales","support"],"audiences":["internal","client_facing"],"languages":["en"],"do_include":"Customer goals and success metrics\nKey stakeholders and their roles\nTimeline expectations\nIntegration requirements\nImmediate next steps for both parties","perspectives":["party_a","party_b"],"output_format":"markdown","do_not_include":"Contract or pricing details\nInternal resource allocation discussions\nPrevious sales process details","generation_prompt":"Create a structured customer onboarding summary from this kickoff call. Document the customer goals, success criteria, timeline expectations, key stakeholders, and any concerns raised. Include immediate next steps for both sides."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'sales'),
   ARRAY['onboarding','customer-success','kickoff'], 291, 4.50, true, '2026-02-09T00:59:23Z'),

  -- 6. Medical Consultation Report (Medical, 267 downloads)
  (v_author, 'Medical Consultation Report',
   'Professional medical consultation reports with diagnosis, treatment plan, and follow-up schedule.',
   'Generate a formal medical consultation report from the transcription.',
   '{"tone":"formal","domains":["medical"],"audiences":["internal","legal"],"languages":["en"],"do_include":"Vital signs if mentioned\nMedication changes with dosages\nReferrals and follow-up timeline","perspectives":["observer"],"output_format":"markdown","do_not_include":"Insurance or billing details\nPatient complaints about wait times","generation_prompt":"Generate a formal medical consultation report. Include presenting complaint, history of present illness, examination findings, differential diagnosis, management plan, and follow-up."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'medical'),
   ARRAY['medical','consultation','diagnosis'], 267, 4.90, true, '2026-01-12T00:59:23Z'),

  -- 7. Sarkastische Analyse (General, 245 downloads)
  (v_author, 'Sarkastische Analyse',
   'Intelligent-sarkastische Gespraechsanalyse mit pointierter Ironie. Deckt Logik-Unfaelle, Widersprueche und Uebertreibungen auf.',
   'Analysiere das Gespraech in einem intelligent-sarkastischen Stil.',
   '{"tone":"funny","domains":["general"],"audiences":["internal"],"languages":["de"],"do_include":"Ironische Zusammenfassung\nLogik-Widersprueche mit Kommentar\nUeberspitzte Rekonstruktion\nZwischen-den-Zeilen Analyse\nSarkastische Schlussbemerkung","perspectives":["observer"],"output_format":"markdown","do_not_include":"Persoenliche Angriffe\nHerabwuerdigung von geschuetzten Gruppen\nVeraenderte Fakten aus dem Transkript","generation_prompt":"Du analysierst das folgende Gespraech in einem intelligent-sarkastischen Stil.\n\nWICHTIG:\n- Der Sarkasmus soll pointiert, ironisch und sprachlich elegant sein.\n- Keine persoenlichen Angriffe.\n- Keine Herabwuerdigung von geschuetzten Gruppen.\n- Kritik richtet sich auf Aussagen, Logik, Widersprueche oder Uebertreibungen - nicht auf Identitaet.\n- Fakten aus dem Transkript duerfen nicht veraendert werden.\n- Klar erkennbar ironischer Unterton.\n- Sprache: Deutsch."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'general'),
   ARRAY['sarkasmus','humor','ironie','analyse','unterhaltung'], 245, 4.60, true, '2026-02-14T01:18:16Z'),

  -- 8. HR Interview Assessment (HR, 203 downloads)
  (v_author, 'HR Interview Assessment',
   'Structured candidate evaluations from job interviews with competency scoring and hiring recommendations.',
   'Create a structured interview assessment from the conversation.',
   '{"tone":"formal","domains":["hr"],"audiences":["internal","executive"],"languages":["en","de"],"do_include":"Candidate responses to key questions\nSpecific examples they provided\nTechnical skills demonstrated\nOverall recommendation (Hire / No Hire / Maybe)","perspectives":["observer"],"output_format":"markdown","do_not_include":"Personal appearance or age references\nProtected class information\nOff-topic personal discussions","generation_prompt":"Create a structured candidate assessment from this interview. Evaluate communication skills, technical competency, cultural fit, and leadership potential. Provide a summary recommendation with strengths and areas of concern."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'hr'),
   ARRAY['hr','interview','hiring','assessment'], 203, 4.60, true, '2026-01-30T00:59:23Z'),

  -- 9. IT Support Ticket (IT & Support, 189 downloads)
  (v_author, 'IT Support Ticket',
   'Transform support calls into structured tickets with problem description, steps taken, and resolution.',
   'Create a structured IT support ticket from the conversation.',
   '{"tone":"technical","domains":["it","support","technical"],"audiences":["internal","client_facing"],"languages":["en"],"do_include":"Error messages and codes\nSystem/software versions\nSteps to reproduce\nResolution or escalation path","perspectives":["party_a","observer"],"output_format":"markdown","do_not_include":"User frustration or emotional comments\nUnrelated system complaints","generation_prompt":"Create a structured IT support ticket from this conversation. Categorize the issue, document steps already taken, and outline the resolution or escalation path."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'it-support'),
   ARRAY['support','ticketing','troubleshoot'], 189, 4.40, true, '2026-02-02T00:59:23Z'),

  -- 10. Consulting Strategy Brief (Consulting, 178 downloads)
  (v_author, 'Consulting Strategy Brief',
   'Turn client strategy sessions into executive-ready briefs with key findings and action items.',
   'Create an executive strategy brief from the consulting session.',
   '{"tone":"formal","domains":["consulting","business"],"audiences":["executive","client_facing"],"languages":["en"],"do_include":"Current state assessment\nStrategic options with pros and cons\nTimeline and resource estimates\nQuick wins vs long-term initiatives","perspectives":["observer","party_a"],"output_format":"markdown","do_not_include":"Internal consultant discussions\nFee negotiations\nCompetitor consultant mentions","generation_prompt":"Create an executive strategy brief from this consulting session. Structure into situation analysis, key findings, strategic options discussed, recommended next steps, and risk factors. Use clear, concise language suitable for C-level readers."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'consulting'),
   ARRAY['consulting','strategy','executive-brief'], 178, 4.70, true, '2026-02-03T00:59:23Z'),

  -- 11. Legal Deposition Summary (Legal, 156 downloads)
  (v_author, 'Legal Deposition Summary',
   'Accurate deposition summaries with key testimony points, exhibits referenced, and objections noted.',
   'Summarize deposition transcript with key testimony and exhibits.',
   '{"tone":"formal","domains":["legal"],"audiences":["legal"],"languages":["en"],"do_include":"Exact quotes for critical testimony\nExhibit numbers referenced\nTimestamps for key moments\nAreas of contradiction","perspectives":["observer"],"output_format":"markdown","do_not_include":"Off-record discussions\nProcedural smalltalk between attorneys","generation_prompt":"Summarize this deposition transcript. Highlight key testimony, exhibits referenced, objections and rulings, and any inconsistencies in witness statements."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'legal'),
   ARRAY['legal','deposition','testimony'], 156, 4.70, true, '2026-01-27T00:59:23Z'),

  -- 12. Psychoanalyse nach Sigmund Freud (Psychology, 156 downloads)
  (v_author, 'Psychoanalyse nach Sigmund Freud',
   'Tiefenpsychologische Gespraechsanalyse im Stil Sigmund Freuds. Untersucht unbewusste Dynamiken und Abwehrmechanismen.',
   'Analysiere das Gespraech aus psychoanalytischer Perspektive im Stil Freuds.',
   '{"tone":"formal","domains":["psychology"],"audiences":["internal"],"languages":["de"],"do_include":"Offensichtlicher Inhalt\nUnbewusste Dynamik mit Abwehrmechanismen\nEs-Ich-Ueber-Ich Konfliktstruktur\nSymbolische Interpretation\nTherapeutische Vertiefungsfragen","perspectives":["observer"],"output_format":"markdown","do_not_include":"Moderne klinische Diagnostik\nParodie\nOberflaechliche Verhaltensanalyse","generation_prompt":"Du analysierst das folgende Gespraech aus der Perspektive eines psychoanalytischen Denkers im Stil Sigmund Freuds."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'psychology'),
   ARRAY['psychoanalyse','freud','unbewusstes','tiefenpsychologie'], 156, 4.70, true, '2026-02-05T01:28:37Z'),

  -- 13. Humanistische Analyse nach Carl Rogers (Psychology, 143 downloads)
  (v_author, 'Humanistische Analyse nach Carl Rogers',
   'Empathisch-wertschaetzende Gespraechsanalyse im Stil von Carl Rogers. Fokus auf subjektives Erleben und Wachstumspotenzial.',
   'Analysiere das Gespraech aus humanistischer Perspektive im Stil von Carl Rogers.',
   '{"tone":"neutral","domains":["psychology"],"audiences":["internal"],"languages":["de"],"do_include":"Subjektive Erlebenswelt\nInkongruenz-Analyse\nWachstumspotenzial und Ressourcen\nEmpathische Reflexion\nEntwicklungsrichtung","perspectives":["observer"],"output_format":"markdown","do_not_include":"Bewertung oder Pathologisierung\nDiagnostische Labels\nKonfrontative Analyse","generation_prompt":"Du analysierst das folgende Gespraech aus der Perspektive eines humanistischen Psychologen im Stil von Carl Rogers."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'psychology'),
   ARRAY['humanistisch','rogers','empathie','selbstaktualisierung'], 143, 4.80, true, '2026-02-07T01:28:37Z'),

  -- 14. Progressive Inklusions-Analyse (General, 134 downloads)
  (v_author, 'Progressive Inklusions-Analyse (Vogue)',
   'Analyse von Gespraechen aus progressiv-inklusiver Perspektive. Untersucht Sprache, Machtstrukturen und normative Untertoene.',
   'Analysiere das Gespraech aus progressiv-inklusiver Perspektive.',
   '{"tone":"formal","domains":["general","consulting"],"audiences":["internal","executive"],"languages":["de"],"do_include":"Sprach- und Inklusionsanalyse\nMacht- und Strukturanalyse\nNormative Untertoene\nAlternative inklusive Formulierungen\nMeta-Reflexion","perspectives":["observer"],"output_format":"markdown","do_not_include":"Pauschale Abwertung anderer Weltanschauungen\nUnterstellungen ohne Textbasis\nDarstellung als objektive Wahrheit","generation_prompt":"Du analysierst das folgende Gespraech aus der Perspektive einer progressiv orientierten, identitaetssensiblen Person."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'general'),
   ARRAY['inklusion','diversitaet','sprachanalyse','progressiv'], 134, 4.50, true, '2026-02-10T01:18:16Z'),

  -- 15. Behavioristische Analyse nach B.F. Skinner (Psychology, 121 downloads)
  (v_author, 'Behavioristische Analyse nach B.F. Skinner',
   'Verhaltenspsychologische Analyse im Stil von B.F. Skinner. Fokus auf beobachtbare Verhaltensmuster und Verstaerkungsmechanismen.',
   'Analysiere das Gespraech aus behavioristischer Perspektive im Stil von Skinner.',
   '{"tone":"technical","domains":["psychology"],"audiences":["internal"],"languages":["de"],"do_include":"Beobachtbare Verhaltensmuster\nReiz-Reaktions-Konsequenz Analyse\nVerstaerkungsmuster\nUmweltfaktor-Analyse\nKonkrete Interventionsmassnahmen","perspectives":["observer"],"output_format":"markdown","do_not_include":"Spekulation ueber unbewusste Motive\nTiefenpsychologische Interpretation\nSubjektive Gefuehlsanalyse","generation_prompt":"Du analysierst das folgende Gespraech aus der Perspektive eines behavioristischen Psychologen im Stil von B. F. Skinner."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'psychology'),
   ARRAY['behaviorismus','skinner','verstaerkung','verhaltensanalyse'], 121, 4.50, true, '2026-02-06T01:28:37Z'),

  -- 16. Steve Jobs Product Vision Analysis (Consulting, 112 downloads)
  (v_author, 'Steve Jobs Product Vision Analysis',
   'Analyse aus der Perspektive eines visionaeren Produktdenkers. Fokus auf radikale Vereinfachung und User Experience.',
   'Analysiere das Gespraech aus der Perspektive eines visionaeren Produktdenkers im Stil von Steve Jobs.',
   '{"tone":"direct","domains":["consulting","business"],"audiences":["internal","executive"],"languages":["de"],"do_include":"Kernprodukt-Definition\nFokus-Analyse mit Streichempfehlungen\nUser Experience Bewertung\nVorschlaege zur radikalen Vereinfachung\nEmotionale Wirkung\nKlare Entscheidung mit Vision-Statement","perspectives":["observer"],"output_format":"markdown","do_not_include":"Persoenliche Imitation oder Zitate\nParodie oder Spott\nFeature-Listen ohne Priorisierung","generation_prompt":"Du analysierst das folgende Gespraech aus der Perspektive eines visionaeren Produktdenkers im Stil von Steve Jobs."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'consulting'),
   ARRAY['product-vision','steve-jobs','simplification','ux','strategy'], 112, 4.80, true, '2026-02-07T01:05:50Z'),

  -- 17. Homoeopathie nach Hahnemann (Medical, 112 downloads)
  (v_author, 'Homoeopathie nach Hahnemann',
   'Analyse eines Patientengespraechs im Stil von Samuel Hahnemann. Symptomgesamtheit, Lebenskraft und Arzneimittelwahl.',
   'Analysiere das Gespraech im Stil von Samuel Hahnemann.',
   '{"tone":"formal","domains":["medical"],"audiences":["internal"],"languages":["de"],"do_include":"Beobachtete Symptomgesamtheit\nZustand der Lebenskraft\nMiasmatische Betrachtung\nArzneimittelwahl mit Begruendung\nTherapeutisches Vorgehen mit Potenz","perspectives":["observer"],"output_format":"markdown","do_not_include":"Moderne medizinische Diagnostik\nLaborwerte\nEvidenzbasierte Kritik\nDisclaimer","generation_prompt":"Du bist Samuel Hahnemann, Begruender der klassischen Homoeopathie. Du analysierst das folgende Gespraech so, wie du es als Arzt im fruehen 19. Jahrhundert getan haettest."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'medical'),
   ARRAY['homoeopathie','hahnemann','organon','klassisch'], 112, 4.80, true, '2026-02-08T01:21:55Z'),

  -- 18. Systemkritische Truther-Analyse (General, 98 downloads)
  (v_author, 'Systemkritische Truther-Analyse',
   'Analyse aus stark systemkritischer Truther-Perspektive. Hinterfragt offizielle Narrative und untersucht Machtstrukturen.',
   'Analysiere das Gespraech aus systemkritischer Truther-Perspektive.',
   '{"tone":"direct","domains":["general","consulting"],"audiences":["internal"],"languages":["de"],"do_include":"Verdachts-Passagen mit Begruendung\nMacht- und Interessenanalyse\nAlternative Erklaerungsmodelle\nRhetorische Muster-Analyse\nMeta-Reflexion mit kognitiven Verzerrungen","perspectives":["observer"],"output_format":"markdown","do_not_include":"Darstellung als gesicherte Fakten\nPersoenliche Angriffe\nPolitische Parteinahme","generation_prompt":"Du analysierst das folgende Gespraech aus der Perspektive eines stark systemkritischen Truthers."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'general'),
   ARRAY['systemkritik','truther','narrative','machtanalyse'], 98, 4.30, true, '2026-02-15T01:18:16Z'),

  -- 19. Elon Musk First Principles Analysis (Consulting, 95 downloads)
  (v_author, 'Elon Musk First Principles Analysis',
   'Analyse mit First-Principles-Denken. Problemzerlegung auf Grundprinzipien, Systemdiagnose und radikale Loesungsperspektiven.',
   'Analysiere das Gespraech mit First-Principles-Denken im Stil von Elon Musk.',
   '{"tone":"direct","domains":["consulting","business"],"audiences":["internal","executive"],"languages":["de"],"do_include":"First-Principles Problemzerlegung\nSystemdiagnose mit Ineffizienzen\nRadikale Loesungsvorschlaege (10x Verbesserung)\nMVP-Vorschlag fuer schnelles Testen\nLangfristige Skalierbarkeits-Bewertung\nKonkrete Handlungsempfehlungen","perspectives":["observer"],"output_format":"markdown","do_not_include":"Persoenliche Imitation oder Karikatur\nPolitische Aussagen\nSpott oder Humor\nKonventionelle Loesungen ohne Begruendung","generation_prompt":"Du analysierst das folgende Gespraech aus der Perspektive eines technologisch getriebenen Unternehmers mit First-Principles-Denken."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'consulting'),
   ARRAY['first-principles','elon-musk','innovation','scalability'], 95, 4.70, true, '2026-02-13T01:05:50Z'),

  -- 20. Homoeopathie nach Vithoulkas (Medical, 94 downloads)
  (v_author, 'Homoeopathie nach George Vithoulkas (Levels of Health)',
   'Analyse nach Vithoulkas mit Levels of Health, energetischer Dynamik und prognoseorientierter Arzneimittelwahl.',
   'Analysiere das Gespraech nach George Vithoulkas Levels of Health.',
   '{"tone":"formal","domains":["medical"],"audiences":["internal"],"languages":["de"],"do_include":"Gesundheitslevel-Einschaetzung\nEnergetische Dynamik-Analyse\nArzneimittelwahl mit energetischer Begruendung\nPrognose mit Reaktionswahrscheinlichkeit\nRepertorielle Zusammenfassung","perspectives":["observer"],"output_format":"markdown","do_not_include":"Moderne medizinische Diagnostik\nLaborwerte\nEvidenzbasierte Kritik\nDisclaimer","generation_prompt":"Du bist George Vithoulkas, moderner Vertreter der klassischen Homoeopathie. Du analysierst das folgende Gespraech nach deinem Konzept der Levels of Health."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'medical'),
   ARRAY['homoeopathie','vithoulkas','levels-of-health','energetisch'], 94, 4.80, true, '2026-02-12T01:21:55Z'),

  -- 21. Homoeopathie nach James Tyler Kent (Medical, 89 downloads)
  (v_author, 'Homoeopathie nach James Tyler Kent',
   'Analyse nach der Kent-Schule mit hierarchischer Symptombewertung und repertorialer Betrachtung.',
   'Analysiere das Gespraech nach den Prinzipien von James Tyler Kent.',
   '{"tone":"formal","domains":["medical"],"audiences":["internal"],"languages":["de"],"do_include":"Hierarchische Symptomanalyse\nRepertoriale Erwaegung mit Rubriken\nArzneimittelentscheidung mit Begruendung\nBehandlungsstrategie mit Potenz","perspectives":["observer"],"output_format":"markdown","do_not_include":"Moderne medizinische Terminologie\nKritik oder Relativierung\nDisclaimer","generation_prompt":"Du bist James Tyler Kent, klassischer Homoeopath, Autor des Kent Repertory. Du analysierst das folgende Gespraech ausschliesslich nach den Prinzipien der klassischen Kentschen Schule."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'medical'),
   ARRAY['homoeopathie','kent','repertorium','hierarchisch'], 89, 4.70, true, '2026-02-09T01:21:55Z'),

  -- 22. Warren Buffett Investment Analysis (Consulting, 87 downloads)
  (v_author, 'Warren Buffett Investment Analysis',
   'Analyse aus der Perspektive eines langfristig orientierten Value-Investors. Geschaeftsmodell, Burggraben und Kapitalallokation.',
   'Analysiere das Gespraech aus der Perspektive eines langfristig orientierten Investors im Stil von Warren Buffett.',
   '{"tone":"formal","domains":["consulting","business"],"audiences":["internal","executive"],"languages":["de"],"do_include":"Geschaeftsmodell-Bewertung\nOekonomischer Burggraben (Moat) Analyse\nRisikofaktoren und strukturelle Risiken\nManagement-Qualitaet Bewertung\nKapitalallokations-Empfehlungen\nKlare Investment-Entscheidung mit Begruendung","perspectives":["observer"],"output_format":"markdown","do_not_include":"Politische Aussagen\nParodie oder Humor\nKurzfristige Spekulation","generation_prompt":"Du analysierst das folgende Gespraech aus der Perspektive eines langfristig orientierten Investors im Stil von Warren Buffett."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'consulting'),
   ARRAY['investment','warren-buffett','value-investing','strategy'], 87, 4.90, true, '2026-02-11T01:04:01Z'),

  -- 23. Homoeopathie Meta-Analyse 3 Schulen (Medical, 76 downloads)
  (v_author, 'Homoeopathie Meta-Analyse (3 Schulen)',
   'Umfassende Meta-Analyse aus drei Schulen: Hahnemann, Kent und Vithoulkas. Parallele Interpretation mit Vergleichsmatrix.',
   'Erstelle eine strukturierte Meta-Analyse aus drei homoeopathischen Schulen.',
   '{"tone":"formal","domains":["medical"],"audiences":["internal"],"languages":["de"],"do_include":"Neutrale Transkript-Extraktion\nParallele Interpretation Hahnemann/Kent/Vithoulkas\nVergleichsmatrix mit Mittelwahl\nKonflikte und Konvergenzen\nFollow-up Interview-Leitfaden pro Schule","perspectives":["observer"],"output_format":"markdown","do_not_include":"Moderne medizinische Diagnostik\nLaborwerte oder evidenzbasierte Kritik\nSpekulation ueber nicht im Transkript Enthaltenes","generation_prompt":"Du erhaeltst ein Gespraechs-Transkript. Erstelle eine strukturierte META-ANALYSE, indem du das gleiche Transkript aus drei klassischen homoeopathischen Schulen interpretierst: A) Samuel Hahnemann B) James Tyler Kent C) George Vithoulkas."}'::jsonb,
   (SELECT id FROM marketplace_categories WHERE slug = 'medical'),
   ARRAY['homoeopathie','meta-analyse','hahnemann','kent','vithoulkas'], 76, 4.90, true, '2026-02-12T01:21:55Z')

  ON CONFLICT DO NOTHING;

  -- ============ COMMUNITY POSTS ============

  INSERT INTO community_posts (author_id, type, title, content, category, tags, upvote_count, comment_count, view_count, is_resolved, is_published, created_at) VALUES

  (v_author, 'article', 'How I Built a MEDDIC Template That Closed 3 Deals',
   E'After experimenting with different sales methodologies, I found that combining MEDDIC with structured follow-up sections dramatically improved our close rate.\n\n## The Key Insight\n\nMost MEDDIC templates focus too heavily on qualification and miss the **action items**. My template adds a dedicated \"Next Steps\" section with automated deadline tracking.\n\n## Results\n\n| Metric | Before | After |\n|--------|--------|-------|\n| Close Rate | 18% | 31% |\n| Follow-up Quality | Low | High |\n| Manager Visibility | Poor | Excellent |\n\nThe biggest improvement came from the **Champion Engagement Score** — a section where the AI evaluates how engaged the champion was during the call based on language cues.',
   'sales', ARRAY['meddic','sales','best-practice'], 3, 3, 346, false, true, '2026-02-20T21:13:52Z'),

  (v_author, 'question', 'Best practice for therapy notes — how do you handle sensitive info?',
   E'I''m a clinical psychologist using Notissima for session notes. My concern is how to handle sensitive patient information in the transcription.\n\nDo you:\n1. Let the AI redact automatically?\n2. Add explicit \"Do not include\" rules?\n3. Post-process manually?\n\nMy current setup: **Perspective:** Observer, **Audience:** Internal, **Tone:** Formal\n\nBut I''m not sure if the \"Do not include\" instructions are robust enough for HIPAA compliance.',
   'psychology', ARRAY['therapy','privacy','best-practice'], 3, 2, 257, true, true, '2026-02-20T18:13:52Z'),

  (v_author, 'tip', 'Pro tip: Use Observer perspective for meeting summaries',
   E'If you want neutral, unbiased meeting summaries, always set the perspective to **Observer / Listener** instead of Party A or B.\n\nThis prevents the AI from favoring one side''s viewpoint and gives you a balanced account of the discussion.\n\nWorks especially well for:\n- Board meetings\n- Mediation sessions\n- Cross-departmental syncs\n- Client discovery calls where objectivity matters',
   'general', ARRAY['tip','meetings','perspective'], 4, 1, 490, false, true, '2026-02-19T23:13:52Z'),

  (v_author, 'question', 'How to handle multiple languages in a single session?',
   E'We have meetings where participants switch between English and German mid-conversation. What''s the best template configuration for this?\n\nShould I set both languages, or just the primary one?\n\nOur typical scenario:\n- 60% German, 40% English\n- Technical terms often stay in English\n- Output should be in German\n\nHas anyone found a reliable approach?',
   'general', ARRAY['multilingual','configuration','languages'], 1, 0, 136, false, true, '2026-02-18T23:13:52Z'),

  (v_author, 'article', 'Building the Perfect Legal Deposition Template',
   E'Legal depositions require extreme accuracy. After 6 months of refining my template, here are the key ingredients:\n\n## 1. Timestamps are critical\nAlways include \"Include timestamps for key statements\" in your Do Include instructions.\n\n## 2. Use Formal tone, always\nLegal documents cannot be casual. Set tone to **Formal**.\n\n## 3. Exact quotes matter\nAdd \"Include exact quotes for critical testimony\" — paraphrasing is not acceptable in legal contexts.',
   'legal', ARRAY['legal','deposition','guide'], 2, 0, 199, false, true, '2026-02-17T23:13:52Z'),

  (v_author, 'tip', 'Add "Highlight areas of disagreement" to your Do Include for sales calls',
   E'This one small instruction made my sales call summaries 10x more useful.\n\nWhen you add **\"Highlight areas of disagreement or unresolved objections\"** to your Do Include, the AI creates a dedicated section that makes follow-up planning much easier.\n\nInstead of reading through the entire summary to find friction points, you get them listed clearly — perfect for prepping the next call.',
   'sales', ARRAY['sales','tip','do-include'], 3, 1, 313, false, true, '2026-02-16T23:13:52Z')

  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Imported 22 templates and 6 community posts with author_id=%', v_author;
END $$;
