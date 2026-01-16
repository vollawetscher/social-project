import Anthropic from '@anthropic-ai/sdk'
import { RohberichtJSON, TranscriptSegment } from '@/lib/types/database'

export interface ClaudeConfig {
  apiKey: string
}

export interface RohberichtInput {
  redactedSegments: TranscriptSegment[]
  redactedText: string
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

  async generateRohbericht(input: RohberichtInput): Promise<RohberichtJSON> {
    try {
      const prompt = this.buildPrompt(input)

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
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
        const rohberichtData: RohberichtJSON = JSON.parse(jsonMatch[0])
        return rohberichtData
      } catch (parseError: any) {
        console.error('JSON parse error:', parseError, 'JSON string:', jsonMatch[0])
        throw new Error(`Failed to parse Claude response: ${parseError.message}`)
      }
    } catch (error: any) {
      console.error('Claude API error:', error)
      throw new Error(`Claude API error: ${error.message}`)
    }
  }

  private buildPrompt(input: RohberichtInput): string {
    const { redactedSegments, redactedText, sessionMetadata } = input

    const formattedTranscript = redactedSegments
      .map((seg) => {
        const timeCode = this.formatTimecode(seg.start_ms)
        return `[${timeCode}] ${seg.speaker}: ${seg.text}`
      })
      .join('\n')

    const duration = this.formatDuration(sessionMetadata.duration_sec)

    return `Du bist ein spezialisiertes KI-System zur Erstellung von strukturierten Gesprächsberichten (Rohberichte) für die Soziale Arbeit.

# Aufgabe
Erstelle einen strukturierten "Rohbericht" basierend auf dem folgenden transkribierten Gespräch. Der Bericht dient zur Dokumentation in der Sozialen Arbeit.

# Metadaten
- Datum: ${new Date(sessionMetadata.created_at).toLocaleDateString('de-DE')}
- Dauer: ${duration}
- Setting/Kontext: ${sessionMetadata.context_note || 'Nicht angegeben'}
- Interne Fallnummer: ${sessionMetadata.internal_case_id || 'Nicht angegeben'}

# Transkript (PII-redaktiert)
${formattedTranscript}

# Wichtige Hinweise
- Alle personenbezogenen Daten wurden bereits entfernt und durch Platzhalter ersetzt ([NAME_X], [ADDRESS_X], etc.)
- KEINE Diagnosen stellen
- KEINE rechtlichen Schlussfolgerungen ziehen
- Risikoindikatoren als Beobachtungen formulieren: "Hinweise auf...", "wirkt...", "es wird berichtet..."
- Deutsch verwenden
- Präzise, sachlich und knapp schreiben

# Ausgabeformat
Antworte NUR mit einem validen JSON-Objekt in folgendem Format:

{
  "session_id": "${sessionMetadata.internal_case_id || 'unbekannt'}",
  "summary_short": "2-3 Sätze Zusammenfassung des Gesprächs",
  "rohbericht": {
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
    "pii_redaction_applied": true
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
