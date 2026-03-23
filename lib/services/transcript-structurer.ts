/**
 * AI structuring for messy transcript files (chat logs, summaries, mixed content).
 * Reorganizes into coherent conversation format for better analysis.
 */
import Anthropic from '@anthropic-ai/sdk'
import { logError } from '@/lib/services/error-logger'
import type { TranscriptContentKind, TranscriptDetectedType } from '@/lib/utils/transcript-type-detection'

export interface StructuredSegment {
  start_ms: number
  end_ms: number
  speaker: string
  text: string
}

export interface StructureResult {
  segments: StructuredSegment[]
  rawText: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  transcriptSignals: {
    contentKind: TranscriptContentKind
    detectedType: TranscriptDetectedType
    confidence: number
    reasons: string[]
  }
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

Output format - JSON object only:
{
  "content_kind": "transcript | non_transcript | mixed",
  "detected_type": "speaker_turns | timestamped_speaker_turns | subtitle_like | chat_export | non_transcript_note | mixed_or_unknown",
  "confidence": 0.0,
  "reasons": ["short reason", "short reason"],
  "segments": [
    { "speaker": "S1", "text": "First utterance...", "start_ms": 0, "end_ms": 5000 },
    { "speaker": "S2", "text": "Second utterance...", "start_ms": 5000, "end_ms": 12000 }
  ]
}
Use sequential timestamps based on estimated speaking time (~150 words/min) only when explicit timestamps are unavailable.`

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num))
}

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

  // Extract JSON from response (prefer object payload, fallback to array-only legacy payload)
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  let parsedObject: any = null
  let parsedArray: Array<{
    speaker?: string
    text?: string
    start_ms?: number
    end_ms?: number
  }> = []

  try {
    const direct = JSON.parse(cleaned)
    if (Array.isArray(direct)) {
      parsedArray = direct
    } else if (direct && typeof direct === 'object') {
      parsedObject = direct
      if (Array.isArray(direct.segments)) parsedArray = direct.segments
    }
  } catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/)
    if (objMatch) {
      try {
        const candidate = JSON.parse(objMatch[0])
        if (candidate && typeof candidate === 'object') {
          parsedObject = candidate
          if (Array.isArray(candidate.segments)) parsedArray = candidate.segments
        }
      } catch {
        // no-op
      }
    }
    if (parsedArray.length === 0) {
      const arrMatch = cleaned.match(/\[[\s\S]*\]/)
      if (arrMatch) {
        try {
          const candidate = JSON.parse(arrMatch[0])
          if (Array.isArray(candidate)) parsedArray = candidate
        } catch {
          // no-op
        }
      }
    }
  }

  if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
    throw new Error('AI structuring returned invalid or empty segments')
  }

  const segments: StructuredSegment[] = []
  let currentMs = 0

  for (const item of parsedArray) {
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
  const transcriptSignals = {
    contentKind: (parsedObject?.content_kind as TranscriptContentKind) || 'mixed',
    detectedType: (parsedObject?.detected_type as TranscriptDetectedType) || 'mixed_or_unknown',
    confidence: clamp(Number(parsedObject?.confidence || 0.6), 0.35, 0.99),
    reasons: Array.isArray(parsedObject?.reasons) ? parsedObject.reasons.slice(0, 8).map((r: any) => String(r)) : ['ai_structurer_detected_type'],
  }
  const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
  return {
    segments,
    rawText,
    transcriptSignals,
    usage: usage
      ? {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
        }
      : undefined,
  }
}
