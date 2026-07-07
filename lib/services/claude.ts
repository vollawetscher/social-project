import Anthropic from '@anthropic-ai/sdk'
import { 
  GenericReportJSON, 
  GespraechsberichtJSON, 
  TranscriptSegment, 
  FilePurpose, 
  Transcript,
  ReportDomain 
} from '@/lib/types/database'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { JSON_ONLY_SUFFIX, withJsonPrefill } from '@/lib/utils/claude-json'

export interface ClaudeConfig {
  apiKey: string
}

export interface ReportInput {
  transcriptsByPurpose: Record<FilePurpose, Transcript[]>
  sessionMetadata: {
    created_at: string
    context_note: string
    internal_case_id: string
    duration_sec: number
    structured_context?: {
      meeting_type?: string
      participants?: Array<{ name: string; role?: string; party?: string }>
      agenda?: Array<{ number?: string; title: string; description?: string }>
      date?: string
      location?: string
      notes?: string
    }
    instructions?: string  // User-provided instructions for report generation
  }
  detectedLanguage?: string  // Language detected by Speechmatics
}

// Legacy interface for backward compatibility
export interface GespraechsberichtInput extends ReportInput {}

export class ClaudeService {
  private client: Anthropic

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    })
  }

  private trackUsage(message: Anthropic.Message, endpoint: string): void {
    const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
    if (!usage || (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) <= 0) return
    try {
      const supabase = createServiceRoleClient()
      recordAiTokens(supabase, null, usage.input_tokens ?? 0, usage.output_tokens ?? 0, { endpoint })
    } catch {
      // Non-blocking billing telemetry.
    }
  }

  /**
   * Analyze and structure context note (participants, agenda, meeting type, etc.)
   */
  async analyzeContext(contextNote: string, language: string = 'de'): Promise<{
    meeting_type?: string
    participants?: Array<{ name: string; role?: string; party?: string }>
    agenda?: Array<{ number?: string; title: string; description?: string }>
    date?: string
    location?: string
    notes?: string
  }> {
    if (!contextNote || contextNote.trim().length === 0) {
      return {}
    }

    const isGerman = language === 'de'
    
    const prompt = isGerman ? `Analysiere den folgenden Kontext-Text und extrahiere strukturierte Informationen:

Kontext:
${contextNote}

Extrahiere folgende Informationen (falls vorhanden):
- Meeting-Typ (z.B. "Stadtratssitzung", "Team-Meeting", "Therapiesitzung")
- Teilnehmer mit Name und Rolle/Partei/Position
- Tagesordnung/Agenda-Punkte
- Datum
- Ort/Location
- Sonstige Notizen

Antworte NUR mit einem JSON-Objekt in diesem Format:
{
  "meeting_type": "Typ des Meetings",
  "participants": [
    {"name": "Vollständiger Name", "role": "Rolle", "party": "Partei (optional)"}
  ],
  "agenda": [
    {"number": "1", "title": "Agenda-Punkt Titel", "description": "Optional"}
  ],
  "date": "YYYY-MM-DD oder Freitext",
  "location": "Ort",
  "notes": "Zusätzliche wichtige Informationen"
}

Falls eine Information nicht vorhanden ist, lasse das Feld weg.` 
    : `Analyze the following context text and extract structured information:

Context:
${contextNote}

Extract the following information (if available):
- Meeting type (e.g. "City Council Meeting", "Team Meeting", "Therapy Session")
- Participants with name and role/party/position
- Agenda items
- Date
- Location
- Other notes

Respond ONLY with a JSON object in this format:
{
  "meeting_type": "Type of meeting",
  "participants": [
    {"name": "Full Name", "role": "Role", "party": "Party (optional)"}
  ],
  "agenda": [
    {"number": "1", "title": "Agenda item title", "description": "Optional"}
  ],
  "date": "YYYY-MM-DD or free text",
  "location": "Location",
  "notes": "Additional important information"
}

If information is not available, omit the field.`

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        temperature: 0.1,
        messages: [
          { role: 'user', content: prompt + JSON_ONLY_SUFFIX },
        ],
      })
      this.trackUsage(message, 'claude/analyze-context')

      const rawText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('\n')
      const responseText = withJsonPrefill(rawText)

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.warn('Failed to parse context, returning empty')
        return {}
      }

      const structured = JSON.parse(jsonMatch[0])
      console.log('[ClaudeService] Context analysis:', {
        meeting_type: structured.meeting_type,
        participants_count: structured.participants?.length || 0,
        agenda_items: structured.agenda?.length || 0
      })
      
      return structured
    } catch (error) {
      console.error('Context analysis error:', error)
      return {}
    }
  }

  /**
   * Improve/structure field text based on field type
   */
  async improveField(
    text: string, 
    fieldName: 'context_text' | 'private_comments' | 'instructions',
    language: string = 'de'
  ): Promise<string> {
    if (!text || text.trim().length === 0) {
      return text
    }

    const isGerman = language === 'de'
    
    // Different prompts based on field type
    let prompt = ''
    
    if (fieldName === 'context_text') {
      prompt = isGerman ? 
        `Du bist ein Assistent der Freitext-Notizen in gut strukturierte, professionelle Kontextinformationen umwandelt.

EINGABE (informell/schlampig):
${text}

AUFGABE:
Strukturiere diese Notizen professionell. Wenn Teilnehmer, Agenda, Datum oder Ort erkennbar sind, formatiere sie klar:

FORMAT:
Teilnehmer:
- Name (Rolle/Position)

Agenda:
1. Thema
2. Weiteres Thema

Datum: [falls erwähnt]
Ort: [falls erwähnt]

Weitere Notizen: [falls relevant]

WICHTIG:
- Halte dich an die Fakten aus dem Input
- Erfinde NICHTS hinzu
- Strukturiere nur was vorhanden ist
- Schreibe auf Deutsch
- KEIN MARKDOWN! Nur normalen Text mit Zeilenumbrüchen

Antworte NUR mit dem strukturierten Text (kein "Hier ist..." oder Metakommentare, kein Markdown).`
        : `You are an assistant that transforms freeform notes into well-structured, professional context information.

INPUT (informal/sloppy):
${text}

TASK:
Structure these notes professionally. If participants, agenda, date, or location are recognizable, format them clearly:

FORMAT:
Participants:
- Name (Role/Position)

Agenda:
1. Topic
2. Another topic

Date: [if mentioned]
Location: [if mentioned]

Additional notes: [if relevant]

IMPORTANT:
- Stick to facts from input
- Do NOT invent anything
- Only structure what exists
- Write in English
- NO MARKDOWN! Only plain text with line breaks

Reply ONLY with the structured text (no "Here is..." or meta comments, no markdown).`
    } else if (fieldName === 'private_comments') {
      prompt = isGerman ?
        `Du bist ein Assistent der informelle private Notizen in professionell formulierte Beobachtungen umwandelt.

EINGABE (informell/schlampig):
${text}

AUFGABE:
Formuliere diese privaten Gedanken/Beobachtungen professionell aus:
- Vollständige Sätze
- Klare Struktur
- Professioneller Ton
- Aber PRIVAT bleibend (keine Weitergabe an Dritte)

WICHTIG:
- Halte dich an die Fakten
- Erfinde NICHTS hinzu
- Schreibe auf Deutsch
- Bleibe objektiv und professionell
- KEIN MARKDOWN! Nur normalen Text mit Zeilenumbrüchen

Antworte NUR mit dem ausformulierten Text (kein "Hier ist..." oder Metakommentare, kein Markdown).`
        : `You are an assistant that transforms informal private notes into professionally formulated observations.

INPUT (informal/sloppy):
${text}

TASK:
Formulate these private thoughts/observations professionally:
- Complete sentences
- Clear structure
- Professional tone
- But remaining PRIVATE (not for third parties)

IMPORTANT:
- Stick to facts
- Do NOT invent anything
- Write in English
- Stay objective and professional
- NO MARKDOWN! Only plain text with line breaks

Reply ONLY with the formulated text (no "Here is..." or meta comments, no markdown).`
    } else if (fieldName === 'instructions') {
      prompt = isGerman ?
        `Du bist ein Assistent der informelle Anweisungen in klare, präzise Instruktionen umwandelt.

EINGABE (informell/schlampig):
${text}

AUFGABE:
Formuliere diese Anweisungen klar und präzise:
- Eindeutige Formulierungen
- Strukturiert (bei mehreren Punkten)
- Handlungsorientiert
- Leicht verständlich

WICHTIG:
- Halte dich an die Intention
- Erfinde NICHTS hinzu
- Schreibe auf Deutsch
- Kurz und prägnant
- KEIN MARKDOWN! Nur normalen Text mit Zeilenumbrüchen

Antworte NUR mit den klaren Anweisungen (kein "Hier ist..." oder Metakommentare, kein Markdown).`
        : `You are an assistant that transforms informal instructions into clear, precise directives.

INPUT (informal/sloppy):
${text}

TASK:
Formulate these instructions clearly and precisely:
- Unambiguous phrasing
- Structured (if multiple points)
- Action-oriented
- Easy to understand

IMPORTANT:
- Stick to the intention
- Do NOT invent anything
- Write in English
- Brief and concise
- NO MARKDOWN! Only plain text with line breaks

Reply ONLY with the clear instructions (no "Here is..." or meta comments, no markdown).`
    }

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      })
      this.trackUsage(message, `claude/improve-field/${fieldName}`)

      const responseText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('\n')
        .trim()

      console.log('[ClaudeService] Field improvement:', {
        fieldName,
        original_length: text.length,
        improved_length: responseText.length
      })
      
      return responseText
    } catch (error) {
      console.error('Field improvement error:', error)
      return text // Return original on error
    }
  }

  /**
   * Detect the domain/topic of the conversation (with optional subdomain)
   */
  async detectDomain(input: ReportInput): Promise<{ 
    domain: ReportDomain; 
    subdomain?: string;
    domain_description?: string;
    confidence: number; 
    language: string 
  }> {
    const { transcriptsByPurpose } = input
    
    // Get a sample of the transcript content
    const allTranscripts = Object.values(transcriptsByPurpose).flat()
    const sampleText = allTranscripts
      .slice(0, 3)
      .map(t => this.formatTranscript(t.raw_json))
      .join('\n\n')
      .substring(0, 3000) // Limit to first 3000 chars for quick detection

    const prompt = `Analyze the following conversation transcript and classify it:

PRIMARY DOMAIN (choose ONE from this list):
- social_work: Social work, case management, client support, welfare services
- healthcare: Medical consultations, patient care, health assessments (physical health)
- mental_health: Therapy, counseling, psychology, psychiatric care
- business: General business, management, strategy, operations
- finance: Banking, insurance, investments, accounting, financial planning
- human_resources: HR, recruiting, personnel management, employee relations
- public_services: Government, administration, public sector, civic services
- legal: Law, contracts, legal advice, court proceedings
- education: Teaching, training, academic, tutoring
- technology: IT support, software, engineering, technical assistance
- customer_service: Customer support, service inquiries, complaints, helpdesk
- creative: Media, marketing, design, journalism, research, communications
- general: Other or mixed domains that don't fit above categories

Transcript sample:
${sampleText}

Respond ONLY with a JSON object in this format:
{
  "domain": "one of the domain values above",
  "subdomain": "specific area (free text, e.g., 'HR Recruiting', 'Trauma Therapy', 'Sales Call')",
  "domain_description": "one sentence natural description",
  "confidence": 85,
  "language": "en or de or other language code",
  "reasoning": "brief explanation"
}`

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        temperature: 0.2,
        messages: [
          { role: 'user', content: prompt + JSON_ONLY_SUFFIX },
        ],
      })
      this.trackUsage(message, 'claude/detect-domain')

      const rawText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('\n')
      const responseText = withJsonPrefill(rawText)

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.warn('Failed to detect domain, defaulting to general')
        return { domain: 'general', confidence: 50, language: 'en' }
      }

      const detection = JSON.parse(jsonMatch[0])
      console.log('[ClaudeService] Domain detection:', detection)
      return {
        domain: detection.domain as ReportDomain,
        subdomain: detection.subdomain,
        domain_description: detection.domain_description,
        confidence: detection.confidence,
        language: detection.language,
      }
    } catch (error) {
      console.error('Domain detection error:', error)
      return { domain: 'general', confidence: 50, language: 'en' }
    }
  }

  /**
   * Generate a generic report with automatic domain detection
   */
  async generateReport(input: ReportInput): Promise<GenericReportJSON> {
    // Use Speechmatics-detected language if provided, otherwise detect from transcript
    // Normalize language code: 'de-DE' -> 'de', 'en-US' -> 'en'
    const rawLanguage = input.detectedLanguage || 'en'
    const language = rawLanguage.toLowerCase().split('-')[0]
    console.log('[ClaudeService] Using language:', language, '(normalized from:', rawLanguage + ')')
    
    // Detect domain only (language already known)
    const detection = await this.detectDomain(input)
    const prompt = this.buildGenericPrompt(input, { 
      domain: detection.domain, 
      language: language 
    })

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16384,
      temperature: 0.3,
      messages: [
        { role: 'user', content: prompt + JSON_ONLY_SUFFIX },
      ],
    })
    this.trackUsage(message, 'claude/generate-report')

    if (message.stop_reason === 'max_tokens') {
      console.warn('[generateReport] Response was truncated (hit max_tokens). Report may be incomplete.')
    }

    const rawText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n')
    const responseText = withJsonPrefill(rawText)

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Claude response without JSON:', responseText)
      throw new Error('Failed to extract JSON from Claude response')
    }

    try {
      const reportData: GenericReportJSON = JSON.parse(jsonMatch[0])
      // Add detection metadata if not already present
      reportData.detected_domain = reportData.detected_domain || detection.domain
      reportData.detected_subdomain = reportData.detected_subdomain || detection.subdomain
      reportData.domain_description = reportData.domain_description || detection.domain_description
      reportData.detected_language = reportData.detected_language || language
      return reportData
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError, 'JSON string:', jsonMatch[0])
      throw new Error(`Failed to parse Claude response: ${parseError.message}`)
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async generateGespraechsbericht(input: GespraechsberichtInput): Promise<GespraechsberichtJSON> {
    try {
      const prompt = this.buildPrompt(input)

      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16384,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })
      this.trackUsage(message, 'claude/generate-gespraechsbericht')

      if (message.stop_reason === 'max_tokens') {
        console.warn('[generateGespraechsbericht] Response was truncated (hit max_tokens). Report may be incomplete.')
      }

      const rawText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('\n')
      const responseText = withJsonPrefill(rawText)

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('Claude response without JSON:', responseText)
        throw new Error('Failed to extract JSON from Claude response')
      }

      try {
        const gespraechsberichtData: GespraechsberichtJSON = JSON.parse(jsonMatch[0])
        return gespraechsberichtData
      } catch (parseError: any) {
        console.error('JSON parse error:', parseError, 'JSON string:', jsonMatch[0])
        throw new Error(`Failed to parse Claude response: ${parseError.message}`)
      }
    } catch (error: any) {
      console.error('Claude API error:', error)
      throw new Error(`Claude API error: ${error.message}`)
    }
  }

  private buildGenericPrompt(
    input: ReportInput, 
    detection: { domain: ReportDomain; language: string }
  ): string {
    const { transcriptsByPurpose, sessionMetadata } = input
    const duration = this.formatDuration(sessionMetadata.duration_sec)
    
    // Determine language for the report (handle both 'de' and 'de-DE' formats)
    const normalizedLang = detection.language.toLowerCase().split('-')[0]
    const isGerman = normalizedLang === 'de'
    
    let promptSections = isGerman 
      ? this.buildGermanPromptHeader(sessionMetadata, duration, detection.domain)
      : this.buildEnglishPromptHeader(sessionMetadata, duration, detection.domain)

    // Add structured context if available
    if (sessionMetadata.structured_context) {
      const ctx = sessionMetadata.structured_context
      const sectionTitle = isGerman ? '# Strukturierter Context' : '# Structured Context'
      const sectionDesc = isGerman
        ? 'Vorab extrahierte Informationen über das Meeting/Gespräch:'
        : 'Pre-extracted information about the meeting/conversation:'
      
      promptSections += `\n${sectionTitle}\n${sectionDesc}\n\n`
      
      if (ctx.meeting_type) {
        promptSections += isGerman 
          ? `**Meeting-Typ:** ${ctx.meeting_type}\n`
          : `**Meeting Type:** ${ctx.meeting_type}\n`
      }
      
      if (ctx.date) {
        promptSections += isGerman 
          ? `**Datum:** ${ctx.date}\n`
          : `**Date:** ${ctx.date}\n`
      }
      
      if (ctx.location) {
        promptSections += isGerman 
          ? `**Ort:** ${ctx.location}\n`
          : `**Location:** ${ctx.location}\n`
      }
      
      if (ctx.participants && ctx.participants.length > 0) {
        const label = isGerman ? '**Teilnehmer:**' : '**Participants:**'
        promptSections += `\n${label}\n`
        ctx.participants.forEach(p => {
          let line = `- ${p.name}`
          if (p.role) line += ` (${p.role})`
          if (p.party) line += ` [${p.party}]`
          promptSections += line + '\n'
        })
      }
      
      if (ctx.agenda && ctx.agenda.length > 0) {
        const label = isGerman ? '**Tagesordnung:**' : '**Agenda:**'
        promptSections += `\n${label}\n`
        ctx.agenda.forEach(item => {
          let line = item.number ? `${item.number}. ${item.title}` : `- ${item.title}`
          if (item.description) line += ` (${item.description})`
          promptSections += line + '\n'
        })
      }
      
      if (ctx.notes) {
        const label = isGerman ? '**Zusätzliche Notizen:**' : '**Additional Notes:**'
        promptSections += `\n${label}\n${ctx.notes}\n`
      }
      
      promptSections += '\n'
    }

    // Add user instructions if provided
    if (sessionMetadata.instructions && sessionMetadata.instructions.trim().length > 0) {
      const sectionTitle = isGerman ? '# Spezielle Anweisungen für diesen Report' : '# Special Instructions for this Report'
      const sectionDesc = isGerman
        ? 'Der Benutzer hat folgende spezielle Anweisungen gegeben. Befolge diese Anweisungen:'
        : 'The user has provided the following special instructions. Follow these instructions:'
      
      promptSections += `\n${sectionTitle}\n${sectionDesc}\n\n${sessionMetadata.instructions}\n\n`
    }

    // Add context recordings
    if (transcriptsByPurpose.context.length > 0) {
      const sectionTitle = isGerman ? '# Kontext-Aufnahmen (Vorbereitung)' : '# Context Recordings (Preparation)'
      const sectionDesc = isGerman 
        ? 'Diese Aufnahmen enthalten Hintergrundinformationen und Vorbereitung. Nutze sie als Kontext für die Analyse.'
        : 'These recordings contain background information and preparation. Use them as context for the analysis.'
      
      promptSections += `${sectionTitle}\n${sectionDesc}\n\n`
      transcriptsByPurpose.context.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        const label = isGerman ? 'Kontext' : 'Context'
        promptSections += `## ${label} ${idx + 1}\n${formatted}\n\n`
      })
    }

    // Add main meeting recordings
    if (transcriptsByPurpose.meeting.length > 0) {
      const sectionTitle = isGerman ? '# Haupt-Gespräch(e)' : '# Main Conversation(s)'
      const sectionDesc = isGerman
        ? 'Dies ist/sind das/die Hauptgespräch(e), worauf der Bericht fokussieren soll.'
        : 'This is/these are the main conversation(s) that the report should focus on.'
      
      promptSections += `${sectionTitle}\n${sectionDesc}\n\n`
      transcriptsByPurpose.meeting.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        const label = isGerman ? 'Gespräch' : 'Conversation'
        promptSections += `## ${label} ${idx + 1}\n${formatted}\n\n`
      })
    }

    // Add dictation recordings
    if (transcriptsByPurpose.dictation.length > 0) {
      const sectionTitle = isGerman ? '# Professionelle Nachnotizen (Diktat)' : '# Professional Notes (Dictation)'
      const sectionDesc = isGerman
        ? 'Diese Aufnahmen enthalten professionelle Beobachtungen und Einschätzungen. Integriere diese Perspektiven.'
        : 'These recordings contain professional observations and assessments. Integrate these perspectives.'
      
      promptSections += `${sectionTitle}\n${sectionDesc}\n\n`
      transcriptsByPurpose.dictation.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        const label = isGerman ? 'Diktat' : 'Dictation'
        promptSections += `## ${label} ${idx + 1}\n${formatted}\n\n`
      })
    }

    // Add instruction recordings
    if (transcriptsByPurpose.instruction.length > 0) {
      const sectionTitle = isGerman ? '# Anweisungen/Aufgaben' : '# Instructions/Tasks'
      const sectionDesc = isGerman
        ? 'Diese Aufnahmen enthalten spezifische Anweisungen oder Aufgaben.'
        : 'These recordings contain specific instructions or tasks.'
      
      promptSections += `${sectionTitle}\n${sectionDesc}\n\n`
      transcriptsByPurpose.instruction.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        const label = isGerman ? 'Anweisungen' : 'Instructions'
        promptSections += `## ${label} ${idx + 1}\n${formatted}\n\n`
      })
    }

    // Add addition recordings
    if (transcriptsByPurpose.addition.length > 0) {
      const sectionTitle = isGerman ? '# Ergänzungen' : '# Additions'
      const sectionDesc = isGerman
        ? 'Diese Aufnahmen enthalten zusätzliche Informationen, die später hinzugefügt wurden.'
        : 'These recordings contain additional information added later.'
      
      promptSections += `${sectionTitle}\n${sectionDesc}\n\n`
      transcriptsByPurpose.addition.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        const label = isGerman ? 'Ergänzung' : 'Addition'
        promptSections += `## ${label} ${idx + 1}\n${formatted}\n\n`
      })
    }

    promptSections += isGerman
      ? this.getGermanOutputFormatSection(sessionMetadata, detection.domain)
      : this.getEnglishOutputFormatSection(sessionMetadata, detection.domain)

    return promptSections
  }

  private buildGermanPromptHeader(metadata: any, duration: string, domain: ReportDomain): string {
    const domainContext = this.getDomainContextGerman(domain)
    
    return `Du bist ein spezialisiertes KI-System zur Erstellung von strukturierten Berichten für professionelle Dokumentation.

🇩🇪 KRITISCH: SCHREIBE DEN GESAMTEN REPORT AUF DEUTSCH! 🇩🇪
Alle Inhalte (summary_short, summary_points, observations, key_quotes, etc.) MÜSSEN auf Deutsch verfasst sein.
Dies ist eine deutsche Konversation - der Report MUSS vollständig auf Deutsch sein!

# Erkannter Bereich
${domainContext}

# Aufgabe
Erstelle einen strukturierten Bericht AUF DEUTSCH basierend auf den folgenden Aufnahmen. Der Bericht dient zur professionellen Dokumentation und MUSS vollständig auf Deutsch verfasst sein.

# Metadaten
- Datum: ${new Date(metadata.created_at).toLocaleDateString('de-DE')}
- Dauer: ${duration}
- Kontext: ${metadata.context_note || 'Nicht angegeben'}
- Interne Referenz: ${metadata.internal_case_id || 'Nicht angegeben'}

`
  }

  private buildEnglishPromptHeader(metadata: any, duration: string, domain: ReportDomain): string {
    const domainContext = this.getDomainContextEnglish(domain)
    
    return `You are a specialized AI system for creating structured reports for professional documentation.

# Detected Domain
${domainContext}

# Task
Create a structured report based on the following recordings. The report is for professional documentation.

# Metadata
- Date: ${new Date(metadata.created_at).toLocaleDateString('en-US')}
- Duration: ${duration}
- Context: ${metadata.context_note || 'Not specified'}
- Internal Reference: ${metadata.internal_case_id || 'Not specified'}

`
  }

  private getDomainContextGerman(domain: ReportDomain): string {
    const contexts: Record<ReportDomain, string> = {
      social_work: 'Sozialarbeit - Fokus auf Klient*innen, Ressourcen, Belastungen und nächste Schritte',
      healthcare: 'Gesundheitswesen - Fokus auf Patientenversorgung, Symptome, Behandlung und Follow-up',
      mental_health: 'Psychische Gesundheit - Fokus auf therapeutische Prozesse, emotionales Wohlbefinden und mentale Unterstützung',
      business: 'Business - Fokus auf Entscheidungen, Aktionspunkte und Geschäftsergebnisse',
      finance: 'Finanzwesen - Fokus auf finanzielle Beratung, Transaktionen, Risiken und Compliance',
      human_resources: 'Personalwesen - Fokus auf Mitarbeiter*innen, Recruiting, Entwicklung und Personalmanagement',
      public_services: 'Öffentlicher Dienst - Fokus auf Bürgerservice, Verwaltungsprozesse und öffentliche Anliegen',
      legal: 'Rechtswesen - Fokus auf rechtliche Punkte, Vereinbarungen und nächste rechtliche Schritte',
      education: 'Bildung - Fokus auf Lernfortschritt, Herausforderungen und pädagogische Strategien',
      technology: 'Technologie - Fokus auf technische Probleme, Lösungen und IT-Support',
      customer_service: 'Kundenservice - Fokus auf Kundenanliegen, Lösungen und Zufriedenheit',
      creative: 'Kreativ/Medien - Fokus auf Konzepte, Strategien, Produktion und kreative Prozesse',
      general: 'Allgemein - Umfassende, flexible Dokumentation',
    }
    return contexts[domain] || contexts.general
  }

  private getDomainContextEnglish(domain: ReportDomain): string {
    const contexts: Record<ReportDomain, string> = {
      social_work: 'Social Work - Focus on clients, resources, challenges, and next steps',
      healthcare: 'Healthcare - Focus on patient care, symptoms, treatment, and follow-up',
      mental_health: 'Mental Health - Focus on therapeutic processes, emotional wellbeing, and mental support',
      business: 'Business - Focus on decisions, action items, and business outcomes',
      finance: 'Finance - Focus on financial advice, transactions, risks, and compliance',
      human_resources: 'Human Resources - Focus on employees, recruiting, development, and personnel management',
      public_services: 'Public Services - Focus on citizen services, administrative processes, and public concerns',
      legal: 'Legal - Focus on legal points, agreements, and next legal steps',
      education: 'Education - Focus on learning progress, challenges, and pedagogical strategies',
      technology: 'Technology - Focus on technical issues, solutions, and IT support',
      customer_service: 'Customer Service - Focus on customer concerns, solutions, and satisfaction',
      creative: 'Creative/Media - Focus on concepts, strategies, production, and creative processes',
      general: 'General - Comprehensive, flexible documentation',
    }
    return contexts[domain] || contexts.general
  }

  private buildPrompt(input: GespraechsberichtInput): string {
    const { transcriptsByPurpose, sessionMetadata } = input

    const duration = this.formatDuration(sessionMetadata.duration_sec)

    // Build sections for each recording type
    let promptSections = `Du bist ein spezialisiertes KI-System zur Erstellung von strukturierten Gesprächsberichten für professionelle Dokumentation.

# Aufgabe
Erstelle einen strukturierten "Gesprächsbericht" basierend auf den folgenden Aufnahmen. Der Bericht dient zur professionellen Dokumentation.

# Metadaten
- Datum: ${new Date(sessionMetadata.created_at).toLocaleDateString('de-DE')}
- Dauer: ${duration}
- Kontext: ${sessionMetadata.context_note || 'Nicht angegeben'}
- Interne Projektnummer: ${sessionMetadata.internal_case_id || 'Nicht angegeben'}

`

    // Add context recordings (preparation/background)
    if (transcriptsByPurpose.context.length > 0) {
      promptSections += `# Kontext-Aufnahmen (Vorbereitung)\n`
      promptSections += `Diese Aufnahmen enthalten Hintergrundinformationen und Vorbereitung. Nutze sie als Kontext für die Analyse des Hauptgesprächs.\n\n`
      transcriptsByPurpose.context.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        promptSections += `## Kontext ${idx + 1}\n${formatted}\n\n`
      })
    }

    // Add main meeting recordings
    if (transcriptsByPurpose.meeting.length > 0) {
      promptSections += `# Haupt-Gespräch(e)\n`
      promptSections += `Dies ist/sind das/die Hauptgespräch(e), worauf der Bericht fokussieren soll.\n\n`
      transcriptsByPurpose.meeting.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        promptSections += `## Gespräch ${idx + 1}\n${formatted}\n\n`
      })
    } else {
      // No meeting recordings - use available recordings as main content
      const totalRecordings = Object.values(transcriptsByPurpose).flat().length
      if (totalRecordings === 0) {
        throw new Error('No recordings found for report generation')
      }
      promptSections += `# Hinweis\n`
      promptSections += `Diese Sitzung enthält keine Hauptbesprechungsaufnahme. Der Bericht basiert auf den verfügbaren Aufnahmen (Kontext, Diktat, Anweisungen oder Ergänzungen).\n\n`
    }

    // Add dictation recordings (professional notes)
    if (transcriptsByPurpose.dictation.length > 0) {
      promptSections += `# Professionelle Nachnotizen (Diktat)\n`
      promptSections += `Diese Aufnahmen enthalten professionelle Beobachtungen und Einschätzungen nach dem Gespräch. Integriere diese Perspektiven in den Bericht.\n\n`
      transcriptsByPurpose.dictation.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        promptSections += `## Diktat ${idx + 1}\n${formatted}\n\n`
      })
    }

    // Add instruction recordings
    if (transcriptsByPurpose.instruction.length > 0) {
      promptSections += `# Anweisungen/Aufgaben\n`
      promptSections += `Diese Aufnahmen enthalten spezifische Anweisungen oder Aufgaben. Füge diese in den Abschnitt "Nächste Schritte" ein.\n\n`
      transcriptsByPurpose.instruction.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        promptSections += `## Anweisungen ${idx + 1}\n${formatted}\n\n`
      })
    }

    // Add addition recordings (supplements)
    if (transcriptsByPurpose.addition.length > 0) {
      promptSections += `# Ergänzungen\n`
      promptSections += `Diese Aufnahmen enthalten zusätzliche Informationen, die später hinzugefügt wurden. Integriere sie an geeigneten Stellen.\n\n`
      transcriptsByPurpose.addition.forEach((t, idx) => {
        const formatted = this.formatTranscript(t.raw_json)
        promptSections += `## Ergänzung ${idx + 1}\n${formatted}\n\n`
      })
    }

    promptSections += `
# Wichtige Hinweise
- Der Fokus liegt auf dem/den Hauptgespräch(en)
- Nutze Kontext-Aufnahmen als Hintergrundinformation
- Integriere professionelle Nachnotizen (Diktate) in deine Analyse
- Füge Anweisungen bei den "Nächsten Schritten" hinzu
- KEINE Diagnosen stellen
- KEINE rechtlichen Schlussfolgerungen ziehen
- Risikoindikatoren als Beobachtungen formulieren: "Hinweise auf...", "wirkt...", "es wird berichtet..."
- Präzise, sachlich und knapp schreiben
`

    promptSections += this.getOutputFormatSection(sessionMetadata)

    return promptSections
  }

  private formatTranscript(segments: TranscriptSegment[]): string {
    return segments
      .map((seg) => {
        const timeCode = this.formatTimecode(seg.start_ms)
        return `[${timeCode}] ${seg.speaker}: ${seg.text}`
      })
      .join('\n')
  }

  private getGermanOutputFormatSection(sessionMetadata: any, domain: ReportDomain): string {
    return `
# Ausgabeformat

🇩🇪🇩🇪🇩🇪 NOCHMALS: GESAMTER REPORT AUF DEUTSCH! 🇩🇪🇩🇪🇩🇪
**KRITISCH: Schreibe JEDEN einzelnen Textinhalt des Reports auf DEUTSCH.**
- summary_short → Deutsch
- summary_points → Deutsch  
- observations → Deutsch
- key_quotes context → Deutsch
- concerns_or_challenges → Deutsch
- suggested_next_steps → Deutsch
ALLES MUSS DEUTSCH SEIN!

Antworte NUR mit einem validen JSON-Objekt in folgendem Format:

{
  "session_id": "${sessionMetadata.internal_case_id || 'unbekannt'}",
  "summary_short": "2-3 Sätze Zusammenfassung",
  "detected_domain": "${domain}",
  "detected_subdomain": "Spezifischer Bereich (z.B. 'HR Recruiting', 'Trauma-Therapie', 'Verkaufsgespräch')",
  "domain_description": "Ein-Satz-Beschreibung des Gesprächsthemas",
  "detected_language": "de",
  "report": {
    "metadata": {
      "date": "TT.MM.JJJJ",
      "duration": "MM:SS",
      "setting": "Beschreibung des Settings",
      "participants": ["Rolle 1", "Rolle 2"],
      "topic": "Hauptthema"
    },
    "summary_points": [
      "Wichtiger Punkt 1",
      "Wichtiger Punkt 2"
    ],
    "key_quotes": [
      {
        "quote": "Relevantes Zitat",
        "timecode": "MM:SS",
        "speaker": "S1",
        "context": "Kontext des Zitats"
      }
    ],
    "observations": [
      "Sachliche Beobachtung 1",
      "Sachliche Beobachtung 2"
    ],
    "topics": [
      "Thema 1",
      "Thema 2"
    ],
    "positive_aspects": [
      "Positive Aspekte, Stärken, Ressourcen",
      "Weitere positive Beobachtungen"
    ],
    "concerns_or_challenges": [
      "Herausforderungen, Bedenken (sachlich formuliert)",
      "Weitere Beobachtungen"
    ],
    "open_questions": [
      "Offene Fragen",
      "Unklare Punkte"
    ],
    "suggested_next_steps": [
      "Vorschlag für nächste Schritte",
      "Weitere Empfehlungen"
    ]
  },
  "quality_notes": {
    "audio_quality": "gut/mittel/schlecht",
    "transcript_confidence": "hoch/mittel/niedrig",
    "pii_redaction_applied": false
  }
}

Wichtige Hinweise:
- KEINE Diagnosen stellen
- KEINE rechtlichen Schlussfolgerungen ziehen
- Sachlich, präzise und professionell schreiben
- Beobachtungen als solche formulieren, nicht als Fakten

Gib NUR das JSON-Objekt zurück, ohne zusätzlichen Text.`
  }

  private getEnglishOutputFormatSection(sessionMetadata: any, domain: ReportDomain): string {
    return `
# Output Format

🇬🇧🇬🇧🇬🇧 AGAIN: ENTIRE REPORT IN ENGLISH! 🇬🇧🇬🇧🇬🇧
**CRITICAL: Write EVERY single text content of the report in ENGLISH.**
- summary_short → English
- summary_points → English
- observations → English
- key_quotes context → English
- concerns_or_challenges → English
- suggested_next_steps → English
EVERYTHING MUST BE IN ENGLISH!

Respond ONLY with a valid JSON object in the following format:

{
  "session_id": "${sessionMetadata.internal_case_id || 'unknown'}",
  "summary_short": "2-3 sentence summary",
  "detected_domain": "${domain}",
  "detected_subdomain": "Specific area (e.g., 'HR Recruiting', 'Trauma Therapy', 'Sales Call')",
  "domain_description": "One-sentence description of the conversation topic",
  "detected_language": "en",
  "report": {
    "metadata": {
      "date": "MM/DD/YYYY",
      "duration": "MM:SS",
      "setting": "Description of the setting",
      "participants": ["Role 1", "Role 2"],
      "topic": "Main topic"
    },
    "summary_points": [
      "Key point 1",
      "Key point 2"
    ],
    "key_quotes": [
      {
        "quote": "Relevant quote",
        "timecode": "MM:SS",
        "speaker": "S1",
        "context": "Context of the quote"
      }
    ],
    "observations": [
      "Factual observation 1",
      "Factual observation 2"
    ],
    "topics": [
      "Topic 1",
      "Topic 2"
    ],
    "positive_aspects": [
      "Positive aspects, strengths, resources",
      "Additional positive observations"
    ],
    "concerns_or_challenges": [
      "Challenges, concerns (factually stated)",
      "Additional observations"
    ],
    "open_questions": [
      "Open questions",
      "Unclear points"
    ],
    "suggested_next_steps": [
      "Suggested next steps",
      "Additional recommendations"
    ]
  },
  "quality_notes": {
    "audio_quality": "good/medium/poor",
    "transcript_confidence": "high/medium/low",
    "pii_redaction_applied": false
  }
}

Important notes:
- DO NOT make diagnoses
- DO NOT draw legal conclusions
- Write factually, precisely, and professionally
- Frame observations as observations, not as facts

Return ONLY the JSON object, without any additional text.`
  }

  private getOutputFormatSection(sessionMetadata: any): string {
    return `
# Ausgabeformat
Antworte NUR mit einem validen JSON-Objekt in folgendem Format:

{
  "session_id": "${sessionMetadata.internal_case_id || 'unbekannt'}",
  "summary_short": "2-3 Sätze Zusammenfassung des Gesprächs",
  "gespraechsbericht": {
    "metadaten": {
      "datum": "TT.MM.JJJJ",
      "dauer": "MM:SS",
      "setting": "z.B. Hausbesuch, Erstgespräch",
      "beteiligte_rollen": ["z.B. Sozialarbeiter*in, Klient*in, Familienangehörige"]
    },
    "gespraechsverlauf_kurz": [
      "Stichpunkt 1 zum Verlauf",
      "Stichpunkt 2 zum Verlauf",
      "..."
    ],
    "kernaussagen_zitate": [
      {
        "quote": "Relevantes Zitat aus dem Transkript",
        "timecode": "MM:SS",
        "speaker": "S1 oder S2 etc."
      }
    ],
    "beobachtungen": [
      "Sachliche Beobachtung 1",
      "Sachliche Beobachtung 2",
      "..."
    ],
    "themen": [
      "Hauptthema 1",
      "Hauptthema 2",
      "..."
    ],
    "ressourcen_und_schutzfaktoren": [
      "Ressource/Schutzfaktor 1",
      "Ressource/Schutzfaktor 2",
      "..."
    ],
    "belastungen_und_risikoindikatoren": [
      "Formuliere als Beobachtung, z.B. 'Hinweise auf finanzielle Belastung'",
      "Weitere Beobachtung",
      "..."
    ],
    "offene_punkte": [
      "Was ist noch unklar?",
      "Welche Fragen bleiben offen?",
      "..."
    ],
    "naechste_schritte_vorschlag": [
      "Vorschlag für nächste Schritte (nicht verpflichtend)",
      "Weiterer Vorschlag",
      "..."
    ]
  },
  "quality_notes": {
    "audio_quality": "gut/mittel/schlecht",
    "transcript_confidence": "hoch/mittel/niedrig",
    "pii_redaction_applied": false
  }
}

Gib NUR das JSON-Objekt zurück, ohne zusätzlichen Text davor oder danach.`
  }

  private formatTimecode(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
}

export function createClaudeService(): ClaudeService {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  return new ClaudeService({ apiKey })
}
