import Anthropic from '@anthropic-ai/sdk'
import { 
  GenericReportJSON, 
  GespraechsberichtJSON, 
  TranscriptSegment, 
  FilePurpose, 
  Transcript,
  ReportDomain 
} from '@/lib/types/database'

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

  /**
   * Detect the domain/topic of the conversation
   */
  async detectDomain(input: ReportInput): Promise<{ domain: ReportDomain; confidence: number; language: string }> {
    const { transcriptsByPurpose } = input
    
    // Get a sample of the transcript content
    const allTranscripts = Object.values(transcriptsByPurpose).flat()
    const sampleText = allTranscripts
      .slice(0, 3)
      .map(t => this.formatTranscript(t.raw_json))
      .join('\n\n')
      .substring(0, 3000) // Limit to first 3000 chars for quick detection

    const prompt = `Analyze the following conversation transcript and determine:
1. The primary domain/topic
2. Your confidence level (0-100)
3. The primary language

Possible domains:
- social_work: Social work, case management, client support, welfare services
- healthcare: Medical consultations, patient care, health assessments
- business: Business meetings, sales calls, project discussions
- education: Teaching, tutoring, educational assessments
- legal: Legal consultations, court proceedings, legal advice
- customer_service: Customer support, service inquiries, complaints
- general: General conversations that don't fit specific domains

Transcript sample:
${sampleText}

Respond ONLY with a JSON object in this format:
{
  "domain": "one of the domain values above",
  "confidence": 85,
  "language": "en or de or other language code",
  "reasoning": "brief explanation"
}`

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      })

      const responseText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('\n')

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.warn('Failed to detect domain, defaulting to general')
        return { domain: 'general', confidence: 50, language: 'en' }
      }

      const detection = JSON.parse(jsonMatch[0])
      console.log('[ClaudeService] Domain detection:', detection)
      return {
        domain: detection.domain as ReportDomain,
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
    const language = input.detectedLanguage || 'en'
    console.log('[ClaudeService] Using language:', language, input.detectedLanguage ? '(from Speechmatics)' : '(default)')
    
    // Detect domain only (language already known)
    const detection = await this.detectDomain(input)
    const prompt = this.buildGenericPrompt(input, { 
      domain: detection.domain, 
      language: language 
    })

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n')

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Claude response without JSON:', responseText)
      throw new Error('Failed to extract JSON from Claude response')
    }

    try {
      const reportData: GenericReportJSON = JSON.parse(jsonMatch[0])
      // Add detection metadata if not already present
      reportData.detected_domain = reportData.detected_domain || detection.domain
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
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const responseText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('\n')

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
    
    // Determine language for the report
    const isGerman = detection.language === 'de'
    
    let promptSections = isGerman 
      ? this.buildGermanPromptHeader(sessionMetadata, duration, detection.domain)
      : this.buildEnglishPromptHeader(sessionMetadata, duration, detection.domain)

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

# Erkannter Bereich
${domainContext}

# Aufgabe
Erstelle einen strukturierten Bericht basierend auf den folgenden Aufnahmen. Der Bericht dient zur professionellen Dokumentation.

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
      business: 'Business - Fokus auf Entscheidungen, Aktionspunkte und Geschäftsergebnisse',
      education: 'Bildung - Fokus auf Lernfortschritt, Herausforderungen und pädagogische Strategien',
      legal: 'Rechtswesen - Fokus auf rechtliche Punkte, Vereinbarungen und nächste rechtliche Schritte',
      customer_service: 'Kundenservice - Fokus auf Kundenanliegen, Lösungen und Zufriedenheit',
      general: 'Allgemein - Umfassende, flexible Dokumentation',
    }
    return contexts[domain] || contexts.general
  }

  private getDomainContextEnglish(domain: ReportDomain): string {
    const contexts: Record<ReportDomain, string> = {
      social_work: 'Social Work - Focus on clients, resources, challenges, and next steps',
      healthcare: 'Healthcare - Focus on patient care, symptoms, treatment, and follow-up',
      business: 'Business - Focus on decisions, action items, and business outcomes',
      education: 'Education - Focus on learning progress, challenges, and pedagogical strategies',
      legal: 'Legal - Focus on legal points, agreements, and next legal steps',
      customer_service: 'Customer Service - Focus on customer concerns, solutions, and satisfaction',
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
- Interne Fallnummer: ${sessionMetadata.internal_case_id || 'Nicht angegeben'}

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
Antworte NUR mit einem validen JSON-Objekt in folgendem Format:

{
  "session_id": "${sessionMetadata.internal_case_id || 'unbekannt'}",
  "summary_short": "2-3 Sätze Zusammenfassung",
  "detected_domain": "${domain}",
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
Respond ONLY with a valid JSON object in the following format:

{
  "session_id": "${sessionMetadata.internal_case_id || 'unknown'}",
  "summary_short": "2-3 sentence summary",
  "detected_domain": "${domain}",
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
