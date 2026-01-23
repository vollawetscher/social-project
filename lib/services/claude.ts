import Anthropic from '@anthropic-ai/sdk'
import { GespraechsberichtJSON, TranscriptSegment, FilePurpose, Transcript } from '@/lib/types/database'

export interface ClaudeConfig {
  apiKey: string
}

export interface GespraechsberichtInput {
  transcriptsByPurpose: Record<FilePurpose, Transcript[]>
  sessionMetadata: {
    created_at: string
    context_note: string
    internal_case_id: string
    duration_sec: number
  }
}

export class ClaudeService {
  private client: Anthropic

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    })
  }

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
      throw new Error('No main meeting recording found')
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
