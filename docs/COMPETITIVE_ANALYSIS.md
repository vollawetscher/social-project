# Notissima — Wettbewerbsanalyse & Strategische Positionierung

**Erstellt:** 2026-03-11
**Aktualisiert:** 2026-03-12

---

## 1. Marktkontext

### Der Markt für AI Meeting Assistants & Voice Intelligence

- **Marktvolumen 2025:** ~$3 Mrd.
- **Prognose 2026:** ~$6.5 Mrd. (Enterprise-Segment)
- **Prognose 2032–2033:** $5–13 Mrd. (je nach Quelle, CAGR 9–21%)
- **Enterprise-Adoptionsrate:** 79% der Unternehmen nutzen bereits AI-Meeting-Tools
- **72%** der Adoption entfällt auf Enterprise-Kunden

### Analysierte Wettbewerber

Drei Kategorien von Wettbewerbern, sortiert nach Marktrelevanz:

**Tier 1 — Enterprise Meeting Intelligence (>$100M Bewertung)**

| Anbieter | Typ | Preis (Pro) | Funding / Bewertung | ARR / Traction |
|---|---|---|---|---|
| **Microsoft Copilot** | Platform-Addon für M365/Teams | $18–30/User/Mo (+ M365-Lizenz) | Microsoft ($3T+ Marktkapitalisierung) | ~400M M365-User als Basis |
| **Otter.ai** | Meeting-Transkription + Sales Intelligence | $8.33–20/Mo | $63–70M Funding | **$100M ARR** (2025), 35M User, <200 MA |
| **Fireflies.ai** | Meeting-Transkription + CRM-Integration | $10–39/Mo | >$20M Funding, **$1 Mrd. Bewertung** (2025) | $10M ARR (2023), 50%+ YoY Wachstum |

**Tier 2 — Spezialisierte Voice/Meeting Tools ($10M–$100M Bewertung)**

| Anbieter | Typ | Preis (Pro) | Funding / Bewertung | ARR / Traction |
|---|---|---|---|---|
| **Notta** | Meeting-Transkription + Hardware | $13.99/Mo | ~$21M Funding total | 10M User, 72% der Nikkei-225-Firmen |
| **Wispr Flow** | System-Level-Diktat mit KI | $12/Mo | **$81M Funding, $700M Bewertung** | 100x YoY User-Wachstum, 270 Fortune-500-Kunden |

**Tier 3 — Leichtgewichtige Voice-to-Notion Tools**

| Anbieter | Typ | Preis (Pro) | Funding / Bewertung | ARR / Traction |
|---|---|---|---|---|
| **Notis.ai** | WhatsApp Voice Copilot → Notion | $20/Mo | Nicht öffentlich (Indie/Seed) | Nische |
| **Voices.ink** | Voice-App → Notion | $8.99–24.99/Mo | Nicht öffentlich (Indie/Seed) | Nische |
| **Dictanote VoiceIn** | Chrome Browser-Diktat | ~$40/Jahr | Nicht öffentlich | Chrome Web Store |
| **ChatGPT + Whisper** | DIY-Workflow (Thomas Frank) | ~$0.40/Std | — | Tutorial-basierte Community |

---

## 2. Wettbewerber-Profile

### Microsoft 365 Copilot (Teams)

**Was es tut:** AI-Assistent eingebettet in Microsoft Teams. Transkribiert Meetings in Echtzeit, erstellt Zusammenfassungen, extrahiert Action Items, beantwortet Fragen zum Meeting-Kontext. Cross-App-Intelligenz (Chats, Dateien, Aufgaben).

**Stärken:**
- Tiefste Plattform-Integration: lebt direkt in Teams, Outlook, Word, PowerPoint
- Automatisches Meeting-Recap nach jedem Teams-Call
- Custom Dictionaries für Fachterminologie pro Tenant
- Recap-Templates anpassbar (Speaker Summary, Executive Report)
- Enterprise-Grade: SSO, Compliance, HIPAA, Tenant-Level-Admin
- Kein separates Tool nötig — Nutzer bleiben in ihrer gewohnten Umgebung

**Schwächen:**
- **Kein domänenspezifischer Output:** Generische Zusammenfassungen, keine fachlich strukturierten Berichte
- **Kein Template-Ökosystem:** Recap-Templates sind einfache Format-Anpassungen, keine inhaltlichen Domänen-Templates
- **Keine Output-Konfiguration:** Kein Perspektiv-/Ton-/Zielgruppen-Wechsel
- **Kein Multi-File-Kontext:** Kann nur einzelne Meetings verarbeiten, kein Kontext-Dokument + Ergänzung
- **Kein Audio-Upload:** Nur Live-Teams-Meetings, keine Diktate oder externe Aufnahmen
- **Extrem teuer:** $18–30/User/Mo PLUS M365-Lizenz ($12.50–57/User/Mo) = **$30–87/User/Mo total**
- **Lock-in:** Funktioniert NUR im Microsoft-Ökosystem
- **Keine PII-Redaktion** im Output
- **Kein Consent-Management** pro Teilnehmer

**Preis:** $18–30/User/Mo als Add-on, setzt M365-Abonnement voraus. Minimum 300 Seats für Enterprise.

### Otter.ai

**Was es tut:** Meeting-Transkriptionsplattform mit "OtterPilot" Bot, der automatisch Zoom/Teams/Meet-Calls beitritt. Sales-Intelligence-Features (Otter Sales Notetaker), AI Chat über alle vergangenen Meetings.

**Stärken:**
- **OtterPilot:** Automatischer Meeting-Bot für Zoom, Teams, Meet
- $100M ARR mit <200 Mitarbeitern — extrem kapitaleffizient
- AI Chat: Fragen über alle vergangenen Meetings stellen
- Otter Sales Notetaker: CRM-Integration (Salesforce, HubSpot, Dynamics, Zoho)
- Zapier-Integration (Pro+)
- Notion-Integration (Enterprise nativ, sonst via Zapier)
- Solide Free-Tier: 300 Min/Monat

**Schwächen:**
- **Kein domänenspezifischer Output:** Generische Summaries + Action Items
- **Kein Template-Ökosystem**
- **Keine Output-Konfiguration** (Perspektive, Ton, Zielgruppe)
- **Kein Multi-File-Kontext**
- **Keine PII-Redaktion**
- **Kein Consent-Management**
- **Keine integrierten Anrufe** — Bot tritt BESTEHENDEN Calls bei, kann keine eigenen initiieren
- **Primär Englisch** — eingeschränkte Mehrsprachigkeit
- **Meeting-zentriert:** Kann keine Diktate, Interviews oder Feldnotizen ohne Meeting-Kontext verarbeiten

**Preis:** Free / $8.33 / $20 / Enterprise (custom)

### Fireflies.ai

**Was es tut:** Meeting-Intelligence-Plattform mit Fokus auf Sales und CRM-Integration. Transkription in 100+ Sprachen, Talk-Time-Analytics, Conversation Intelligence.

**Stärken:**
- 100+ Sprachen Transkription
- Meeting-Bot für Zoom, Teams, Meet, Webex
- Talk-Time-Analytics und Conversation Intelligence (wer redet wie viel)
- GraphQL API + Zapier für flexible Integration
- AskFred AI Assistant: Fragen über Meetings
- Notion-Integration via Zapier
- Mobile App (iOS + Android)

**Schwächen:**
- Identisch mit Otter: **kein domänenspezifischer Output, kein Template-System, keine Output-Konfiguration, kein Multi-File, keine PII-Redaktion, kein Consent**
- **Kein eigenes Calling** — nur Meeting-Bot
- CRM-Integration nur via Zapier (nicht nativ wie bei Otter Enterprise)

**Preis:** Free / $10 / $19 / ~$39 pro User/Mo

### Notta

**Was es tut:** Meeting-Transkription mit Zoom/Meet/Teams-Bot plus dediziertes Hardware-Gerät (Notta Memo AI, $149).

**Stärken:**
- Meeting-Bot für Zoom, Google Meet, Teams
- Dediziertes Hardware-Recording-Gerät (Memo AI)
- Starke Präsenz in Japan (72% der Nikkei-225-Firmen)
- Dual-Revenue: SaaS + Hardware

**Schwächen:**
- Identische Output-Limitierungen wie Otter/Fireflies
- Kleineres Integrations-Ökosystem
- Primär Japan-fokussiert, globale Expansion erst im Aufbau

**Preis:** Free / $13.99 / $19.99 / Enterprise

### Wispr Flow

**Was es tut:** System-Level-Diktiertool mit KI-Befehlen. Läuft als Overlay über jede App — Nutzer spricht, Wispr tippt.

**Stärken:**
- **System-Level:** Funktioniert in jeder App (E-Mail, CRM, Chat, Docs)
- Schreibstil-Lernen: Adaptiert sich an den User über Zeit
- $81M Funding bei $700M Bewertung — massiver Investor-Confidence
- 270 Fortune-500-Kunden, 100x YoY User-Wachstum
- 70% 12-Monats-Retention

**Schwächen:**
- **Kein strukturierter Output:** Wispr diktiert Text, generiert keine Berichte
- **Kein Template-System, kein Marketplace**
- **Kein Meeting-Kontext:** Einzelne Diktate, kein Multi-File
- **Kein Audio-Upload:** Nur Live-Diktat
- **Nur macOS** (Android in Entwicklung)
- Komplett anderer Use Case: Diktat-Ersatz, nicht Dokumentation

**Preis:** $12/Mo (ab $8.33 jährlich)

### Tier-3-Tools (Notis.ai, Voices.ink, VoiceIn, ChatGPT+Whisper)

Leichtgewichtige Tools mit einem gemeinsamen Profil:
- Voice-to-Text mit einfacher Notion-Integration
- Kein strukturierter Output, keine Domänen-Intelligenz
- Kein Marketplace, kein Template-System, keine Anrufe
- Kleine Teams, geringe Marktmacht
- Relevanz: zeigen die Nachfrage nach "Voice → Notion"-Workflows

---

## 3. Feature-Vergleichsmatrix

| Feature | Notissima | MS Copilot | Otter.ai | Fireflies | Notta | Wispr Flow | Tier 3 |
|---|---|---|---|---|---|---|---|
| **Domänen-intelligente Berichte** | 13 Bereiche | Nein | Nein | Nein | Nein | Nein | Nein |
| **Template-Marketplace** | Ja (Creator-Ökosystem) | Nein | Nein | Nein | Nein | Nein | Nein |
| **Output-Konfiguration** (Perspektive/Ton/Zielgruppe/Sprache) | 4 Dimensionen | Nein | Nein | Nein | Nein | Nein | Nein |
| **Multi-File-Sessions** | Ja | Nein | Nein | Nein | Nein | Nein | Nein |
| **PII-Redaktion** | Automatisch | Nein | Nein | Nein | Nein | Nein | Nein |
| **Consent-Management** | Pro Teilnehmer | Nein | Nein | Nein | Nein | Nein | Nein |
| **Meeting-Bot** (Zoom/Teams/Meet) | Nein | Ja (Teams only) | Ja | Ja | Ja | Nein | Nein |
| **CRM-Integration** | Nein | Outlook/Dynamics | Salesforce, HubSpot, Dynamics, Zoho | Via Zapier | Begrenzt | Nein | Nein |
| **Notion-Integration** | Copy-Paste (universell) | Nein | Enterprise/Zapier | Zapier | Nein | Nein | Nativ (API) |
| **Zapier/API** | Nein | Microsoft Graph | Ja (Pro+) | Ja (GraphQL) | Begrenzt | Nein | Nein |
| **Eigene Anrufe** (Video/PSTN) | Ja (LiveKit + Twilio) | Teams-Calls | Nein | Nein | Nein | Nein | Nein |
| **Audio-Upload** (Dateien) | Ja (Multi-Format) | Nein | Ja (Pro+) | Ja | Ja | Nein | Nein |
| **Eingebautes Recording** | PWA + Shortcut | Nein (Teams required) | In-App + Bot | In-App + Bot | In-App + Hardware | System-Level | Nein |
| **Conversation Intelligence** (Talk-Time etc.) | Nein | Begrenzt | Ja | Ja | Nein | Nein | Nein |
| **AI Chat über Meetings** | Nein | Ja | Ja | Ja (AskFred) | Nein | Nein | Nein |
| **Schreibstil-Lernen** | Nein (Templates) | Nein | Nein | Nein | Nein | Ja | Nein |
| **Sprachen (Output)** | DE, EN, ES | ~25 | Primär EN | 100+ Transkr. | Multi | EN | EN |
| **Export-Formate** | PDF, Word, Markdown | Word, Teams-Recap | TXT, PDF, SRT | TXT, PDF, SRT | TXT, PDF, SRT | — | Notion-Seite |
| **GDPR/HIPAA** | GDPR-ready (RLS, Audit) | Enterprise Compliance | HIPAA (Enterprise) | HIPAA (Enterprise) | SOC 2 | Nein | Nein |

---

## 4. Stärken-Schwächen-Analyse (SWOT-Perspektive)

### Notissimas Stärken

| Stärke | Warum einzigartig | Wettbewerber-Lücke |
|---|---|---|
| **Domänen-Intelligenz** | 13 Fachbereiche mit 2-Layer-Klassifikation und angepasster Berichtsstruktur | KEIN Wettbewerber — weder Copilot noch Otter — generiert fachlich strukturierte Berichte |
| **Template-Marketplace** | Creator-Ökosystem mit IP-Schutz, Anti-Republishing, Strike-System, Bewertungen | Otter hat "Custom Workflows" (Business+), Copilot hat Recap-Templates — beides proprietär, nicht community-driven |
| **Output-Konfiguration** | 4 unabhängige Dimensionen (Perspektive, Zielgruppe, Ton, Sprache) | Alle Wettbewerber haben festes Output-Format |
| **Multi-File-Sessions** | Kontext + Meeting + Diktat + Ergänzung in einer Session kombinierbar | Alle Wettbewerber verarbeiten isolierte Meetings/Diktate |
| **PII-Redaktion + Consent** | Automatische Redaktion + pro-Teilnehmer-Consent-Management | Kein Wettbewerber bietet beides |
| **Integrierte Anrufe** | LiveKit WebRTC + Twilio PSTN mit automatischer Transkription | Alle anderen joinen nur bestehende Calls oder haben gar keine Anruf-Funktion |
| **Universeller Output** | Markdown-Export funktioniert in Notion, Google Docs, Obsidian, E-Mail, Slack, CRM | Otter/Fireflies sind auf eigene Integrationen angewiesen; Copilot nur in M365 |
| **Nicht Meeting-zentriert** | Verarbeitet jede Art von Audio: Diktate, Interviews, Feldnotizen, Beratungsgespräche, Anrufe | Copilot/Otter/Fireflies sind auf den Meeting-Kontext fixiert |

### Notissimas Schwächen

| Schwäche | Impact | Wer macht es besser |
|---|---|---|
| **Kein Meeting-Bot** | Business-Kunden erwarten automatische Zoom/Teams-Transkription. Notissima erfordert eigene Calls oder Audio-Upload | Otter, Fireflies, Notta, Copilot (Teams) |
| **Kein Integrations-Ökosystem** | Keine API, kein Zapier, kein CRM-Push. Outputs fließen nicht automatisch in Arbeits-Tools | Otter (Salesforce, HubSpot, Zapier), Fireflies (GraphQL API, Zapier), Copilot (Microsoft Graph) |
| **Keine Conversation Intelligence** | Keine Talk-Time-Analyse, Sprecher-Statistiken, Sales-Coaching-Metriken | Otter, Fireflies |
| **Keine AI-Suche über Sessions** | Kein "Frag die KI über alle vergangenen Gespräche" | Otter (AI Chat), Fireflies (AskFred), Copilot |
| **Geringe Markenbekanntheit** | Gegen $100M ARR (Otter), $1B Bewertung (Fireflies), Microsoft — keine Marktpräsenz | Alle Tier-1-Wettbewerber |
| **Kleine Sprachauswahl** | DE, EN, ES — vs. 100+ bei Fireflies, ~25 bei Copilot | Fireflies, Copilot, Notta |

---

## 5. Marktpositionierung

### Wo Notissima NICHT konkurriert (und nicht sollte)

- **Meeting-Mitschnitt-Massenmarkt:** Copilot, Otter, Fireflies besitzen den "automatisch jedes Meeting transkribieren"-Markt. Dieser Markt wird zur Commodity (Microsoft gibt es quasi als Add-on weg).
- **System-Level-Diktat:** Wispr Flow besitzt diesen Markt und hat $81M Funding dafür.
- **Notion-Pipeline:** Die Tier-3-Tools bedienen Notion-Power-User mit API-Integration.

### Wo Notissima konkurriert (und gewinnen kann)

**Notissimas Markt: Professional Conversation Documentation**

Zielkunden, die nicht einfach eine Zusammenfassung wollen, sondern einen **fachlich strukturierten Bericht**:

| Zielgruppe | Beispiel-Use-Case | Warum Otter/Copilot nicht reicht |
|---|---|---|
| Sozialarbeit | Klient-Gesprächsbericht mit Beobachtungen, Zitaten, Risikoeinschätzung | Braucht domänenspezifische Struktur + PII-Redaktion |
| Psychologie/Therapie | Sitzungsprotokoll mit klinischen Beobachtungen | Braucht Consent-Management + strukturierte Dokumentation |
| Recht | Mandantengespräch mit Sachverhaltsdarstellung, Rechtsfragen, Fristen | Braucht Perspektiv-Konfiguration (Anwalt-Sicht vs. Mandant-Sicht) |
| Sales | Kundengespräch mit MEDDIC-Analyse, Next Steps, Objection-Handling | Otter/Fireflies haben generische Summaries, kein Template-System |
| Medizin | Patientendokumentation mit Anamnese-Struktur | Braucht PII-Redaktion + Fachbereichs-spezifische Terminologie |
| Bildung | Elterngespräch oder Beratungsdokumentation | Braucht Multi-File (Vorbereitung + Gespräch + Nachbereitung) |
| Consulting | Workshop-Dokumentation mit Stakeholder-Perspektiven | Braucht Output-Konfiguration (verschiedene Zielgruppen) |

**Kernerkenntnis:** Die Tier-1-Wettbewerber lösen "Was wurde im Meeting gesagt?" — Notissima löst "Was bedeutet das Gesagte für mein Fachgebiet und wie dokumentiere ich es korrekt?"

---

## 6. GTM-Strategie: Beachhead Notion-User

### Markt-Realität

- Notion hat ~100M User
- ~4% zahlen (~4M) → haben API-Zugang
- ~96% nutzen Free/Plus → KEIN API-Zugang
- Otter/Fireflies/Notis.ai/Voices.ink zielen auf die 4% mit API-Integration
- Microsoft Copilot zielt auf M365-Enterprise-Kunden (komplett anderes Segment)
- Die 96% Notion-Free-User sind komplett unterversorgt

### Ansatz: Structured Paste statt API-Integration

| Schritt | Was passiert |
|---|---|
| Input | User nimmt Audio direkt in Notissima auf (PWA, 2-3 Taps) oder lädt Datei hoch |
| Processing | Transkription → KI-Analyse → Template-basierter Output |
| Output | User kopiert strukturierten Markdown-Output (1 Klick) |
| Ziel | User pastet in Notion → Markdown wird korrekt als formatierter Inhalt gerendert |

### Warum das funktioniert

- **Notion versteht Markdown nativ:** Headlines, Listen, Tabellen, Bold etc. werden beim Pasten korrekt gerendert
- **Kein Setup nötig:** Kein OAuth, keine API-Keys, keine Workspace-Permissions
- **Erreicht 100M User statt 4M:** Funktioniert auf jedem Notion-Plan
- **Plattform-agnostisch:** Gleicher Output funktioniert auch in Google Docs, Obsidian, E-Mail, Slack, CRM-Systeme
- **Kein Engineering-Aufwand:** Keine Integration zu bauen oder zu warten

### Notion AI Autofill (Bonus für zahlende Notion-User)

Notion Business ($20/User/Monat) bietet **AI Custom Autofill** für Datenbank-Properties:
- Trigger: Neue Seite wird in Datenbank erstellt
- Aktion: Notion AI scannt den Seiteninhalt und extrahiert Daten in Properties
- Beispiel: Datum, Teilnehmer, Kategorie, Action Items automatisch aus dem gepasteten Notissima-Output

**Was Notissima dafür optimieren kann (kein Engineering nötig):**

1. **Konsistente Output-Struktur:** Jeder Output beginnt mit standardisierten Headings (Zusammenfassung, Teilnehmer, Datum, Nächste Schritte), damit Notion AI zuverlässig parsen kann
2. **Notion-Template bereitstellen:** Eine fertige Notion-Datenbank-Vorlage mit vorkonfigurierten AI-Autofill-Prompts — User dupliziert die Vorlage und pastet Outputs hinein
3. **Setup-Guide:** "So richtest du Notion für Notissima ein" (5 Min, kein Code)

### Wettbewerbsvorteil vs. Integrations-Anbieter

| Kriterium | Otter/Fireflies/Notis.ai | MS Copilot | Notissima |
|---|---|---|---|
| Erreichbare Notion-User | ~4M (nur zahlende) | 0 (kein Notion) | ~100M (alle) |
| Setup-Aufwand | OAuth + DB-Config + Permissions | M365-Lizenz + Copilot-Add-on | Null |
| Output-Qualität | Rohtext + generische Summary | Meeting-Recap + Action Items | Domänen-intelligenter Fachbericht |
| Funktioniert mit anderen Tools | Nur eigene Integrationen | Nur M365-Ökosystem | Jede App die Paste akzeptiert |
| API-Abhängigkeit | Ja (Bruch-Risiko) | Ja (Microsoft-Ökosystem) | Nein |
| Preis (Solo-User) | $8–20/Mo | $30–87/Mo total | tbd |

---

## 7. Strategische Empfehlungen (priorisiert)

### Priorität 1: Output-Struktur für universellen Paste optimieren

- Konsistente Headings in allen Outputs (Zusammenfassung, Teilnehmer, Datum, Nächste Schritte)
- "Copy for Notion" Button (optimiert Markdown für Notion-Rendering)
- Notion-Datenbank-Vorlage mit AI-Autofill-Prompts erstellen und publizieren
- Aufwand: **Niedrig** (Content + UX, kein Backend)

### Priorität 2: Meeting-Bot (Zoom/Teams/Meet)

- Recall.ai oder ähnlichen Service integrieren
- Dies ist der **einzige Feature-Gap**, für den es keinen Workaround gibt
- Business-Kunden mit Zoom/Teams werden Notissima NICHT nutzen, wenn sie dafür ihre Meeting-Plattform wechseln müssen
- Aufwand: **Mittel** (API-Integration, aber kein eigener Bot-Bau nötig)

### Priorität 3: AI-Suche über vergangene Sessions

- "Frag Notissima über all deine Gespräche" — Feature das Otter, Fireflies und Copilot haben
- Hoher Retention-Effekt: je mehr Sessions, desto wertvoller wird die Plattform
- Aufwand: **Mittel-Hoch** (RAG-Pipeline, Embeddings, Search-UI)

### Priorität 4: Notion-API & Zapier als Premium-Feature

- Erst bauen wenn User-Basis da ist und Nachfrage besteht
- Nur für zahlende Notissima-User, nur für zahlende Notion-User
- Kein Beachhead-Blocker — Copy-Paste reicht für Product-Market-Fit
- Aufwand: **Mittel** (OAuth-Flow, API-Endpoints)

### Priorität 5: Schreibstil-Lernen

- Aus vergangenen Outputs lernen und Stil adaptieren
- Personalisierte Prompts basierend auf User-Historie
- Aufwand: **Mittel** (Prompt-Engineering + User-Profiling)

---

## 8. Fazit

### Die Landschaft

Der Markt teilt sich in drei Lager:
1. **Microsoft** drückt Meeting-Intelligence als Commodity in sein bestehendes Ökosystem (400M+ User). Copilot macht generische Transkription + Summary zum Standard-Feature — kein eigenständiges Produkt mehr.
2. **Otter/Fireflies** sind die Meeting-Intelligence-Spezialisten ($100M ARR / $1B Bewertung). Stärke: Meeting-Bot + CRM-Integration + AI-Suche. Schwäche: generische Outputs ohne Fachtiefe.
3. **Voice-Note-Tools** (Notis.ai, Voices.ink, Wispr Flow) bedienen Nischen: Notion-Pipeline, System-Diktat.

### Notissimas Position

Notissima spielt in **keinem dieser drei Lager** — und das ist die Stärke.

**Notissima ist die einzige Plattform für fachlich strukturierte Gesprächsdokumentation.** Kein Wettbewerber — weder ein $3T-Konzern noch ein $1B-Startup — generiert domänenspezifische Berichte mit konfigurierbarer Perspektive, Template-Marketplace, PII-Redaktion und Consent-Management.

Während Copilot, Otter und Fireflies um die Frage kämpfen "Wer transkribiert Meetings am besten?", beantwortet Notissima eine andere Frage: **"Wie dokumentiere ich professionelle Gespräche fachgerecht?"**

### Risiken

- **Commoditisierung:** Microsoft könnte domänenspezifische Templates in Copilot einbauen. Zeitfenster: 12–24 Monate.
- **Otter/Fireflies könnten vertikal expandieren** und Fachbereichs-Outputs anbieten. Wahrscheinlichkeit: mittel (Sales-Fokus dominiert beide).
- **Wispr Flow** bei $700M Bewertung könnte in strukturierte Outputs expandieren. Wahrscheinlichkeit: niedrig (anderer Use Case).

### Empfehlung

**Go-to-Market:** "Professional conversation intelligence. Works everywhere."
- Domänen-Fokus als Differenzierung gegen generische Meeting-Tools
- Copy-Paste als Universalwaffe gegen API-Lock-in
- Meeting-Bot als einziger kritischer Feature-Gap, der priorisiert werden muss
