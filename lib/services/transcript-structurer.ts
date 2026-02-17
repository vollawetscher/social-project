/**
 * AI structuring for messy transcript files (chat logs, summaries, mixed content).
 * Reorganizes into coherent conversation format for better analysis.
 */
import Anthropic from '@anthropic-ai/sdk'
import { logError } from '@/lib/services/error-logger'

export interface StructuredSegment {
  start_ms: number
  end_ms: number
  speaker: string
  text: string
}

export interface StructureResult {
  segments: StructuredSegment[]
  rawText: string
}

const STRUCTURE_PROMPT = `You are given a raw transcript that may contain:
- Chat/messaging logs (e.g. "John (10:32): hello")
- Conference call summaries ("Summary: The team agreed...")
- Meeting notes mixed with quotes
- Bullet points, timestamps, multiple formats

Reorganize this into a CLEAN conversation transcript with clear speaker turns.
- Assign consistent speaker labels (S1, S2, etc. or use names if clear)
- Merge summaries into coherent narrative or attribute to a speaker (e.g. "Moderator")
- Remove redundant formatting (timestamps in text, bullet symbols)
- Preserve all substantive content
- Output ONLY valid JSON, no markdown or explanation

Output format - an array of objects:
[
  { "speaker": "S1", "text": "First utterance...", "start_ms": 0, "end_ms": 5000 },
  { "speaker": "S2", "text": "Second utterance...", "start_ms": 5000, "end_ms": 12000 }
]
Use sequential timestamps based on estimated speaking time (~150 words/min).`

export async function structureTranscript(
  rawContent: string,
  language: string = 'en'
): Promise<StructureResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic({ apiKey })
  const truncated = rawContent.slice(0, 50000) // ~12k tokens input limit consideration

  // Wrap Claude call with a timeout to prevent hanging on very long content
  const TIMEOUT_MS = 90_000 // 90 seconds
  let response: Anthropic.Message
  try {
    response = await Promise.race([
      client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: `${STRUCTURE_PROMPT}\n\nLanguage hint: ${language}\n\nRaw content:\n\n${truncated}`,
          },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`AI structuring timed out after ${TIMEOUT_MS / 1000}s. The content may be too long or complex. Try pasting a shorter excerpt.`)), TIMEOUT_MS)
      ),
    ])
  } catch (err: any) {
    await logError({
      errorType: 'api_error',
      severity: 'error',
      message: `AI structuring failed: ${err?.message || 'Unknown error'}`,
      error: err,
      endpoint: 'structureTranscript',
      metadata: {
        contentLength: rawContent.length,
        truncatedLength: truncated.length,
        language,
        isTimeout: err?.message?.includes('timed out'),
      },
    }).catch(() => {})
    throw err
  }

  const text =
    response.content?.[0]?.type === 'text'
      ? (response.content[0] as { text: string }).text
      : ''
  if (!text.trim()) {
    throw new Error('AI structuring returned empty response')
  }

  // Extract JSON from response (handle possible markdown code block)
  let jsonStr = text.trim()
  const match = text.match(/\[[\s\S]*\]/)
  if (match) jsonStr = match[0]

  const parsed = JSON.parse(jsonStr) as Array<{
    speaker?: string
    text?: string
    start_ms?: number
    end_ms?: number
  }>

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AI structuring returned invalid or empty segments')
  }

  const segments: StructuredSegment[] = []
  let currentMs = 0

  for (const item of parsed) {
    const textContent = typeof item.text === 'string' ? item.text.trim() : ''
    if (!textContent) continue

    const speaker = typeof item.speaker === 'string' ? item.speaker : 'S1'
    const startMs = typeof item.start_ms === 'number' ? item.start_ms : currentMs
    const durationMs = Math.max(
      1000,
      Math.ceil((textContent.split(/\s+/).length * 400)) // ~150 wpm
    )
    const endMs =
      typeof item.end_ms === 'number' && item.end_ms > startMs
        ? item.end_ms
        : startMs + durationMs

    segments.push({
      speaker,
      text: textContent,
      start_ms: startMs,
      end_ms: endMs,
    })
    currentMs = endMs
  }

  const rawText = segments.map((s) => s.text).join(' ')
  return { segments, rawText }
}
