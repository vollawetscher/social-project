/**
 * POST /api/sessions/import-transcript
 *
 * Create a session from uploaded transcript text (TXT, SRT, VTT).
 * Peek heuristics detect messy content (chat, summaries); AI structuring runs only when needed.
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createPIIRedactionService } from '@/lib/services/pii-redaction'
import { needsStructureHeuristic } from '@/lib/utils/transcript-structure-check'
import { structureTranscript } from '@/lib/services/transcript-structurer'
import { detectImportedTextSource } from '@/lib/utils/text-source-detection'
import { detectTranscriptType, type TranscriptIngestionSource } from '@/lib/utils/transcript-type-detection'
import type { TranscriptParseStrategy } from '@/lib/utils/transcript-parser'
import { logError } from '@/lib/services/error-logger'
import Anthropic from '@anthropic-ai/sdk'

interface ParsedSegment {
  start_ms: number
  end_ms: number
  speaker: string
  text: string
}

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

async function generateImportedContentSummary(input: {
  text: string
  languageCode: string
}): Promise<string | null> {
  if (!anthropic) return null

  const transcriptText = String(input.text || '').trim()
  if (!transcriptText || transcriptText.length < 80) return null

  const languageHint = input.languageCode && input.languageCode !== 'auto'
    ? input.languageCode
    : 'same as transcript'

  const truncatedText = transcriptText.slice(0, 24000)
  const prompt = `Summarize the following transcript/imported conversation.

Rules:
- Return 4-8 concise bullet points.
- Each bullet must be one line.
- Keep factual and scannable.
- No headings or intro text.
- Keep output language in ${languageHint}.
- If the text is not a real conversation, still summarize the key intent and important details.

Content:
${truncatedText}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const cleaned = String(text || '')
    .replace(/```(?:text|markdown)?/gi, '')
    .replace(/```/g, '')
    .trim()
  if (!cleaned) return null

  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 8)

  if (lines.length === 0) return null
  return lines.map((line) => `- ${line}`).join('\n')
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    const {
      language = 'auto',
      sessionName,
      segments: incomingSegments,
      rawText: incomingRawText,
      rawFileContent,
      filename,
      ingestionSource = 'unknown',
      parseStrategy = 'auto',
    }: {
      language?: string
      sessionName?: string
      segments: ParsedSegment[]
      rawText: string
      rawFileContent?: string
      filename?: string
      ingestionSource?: TranscriptIngestionSource
      parseStrategy?: TranscriptParseStrategy
    } = body

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, display_name, full_name')
      .eq('id', user.id)
      .maybeSingle()

    let segments: ParsedSegment[]
    let rawText: string
    let aiTranscriptSignals: {
      contentKind: 'transcript' | 'non_transcript' | 'mixed'
      detectedType: 'speaker_turns' | 'timestamped_speaker_turns' | 'subtitle_like' | 'chat_export' | 'non_transcript_note' | 'mixed_or_unknown'
      confidence: number
      reasons: string[]
    } | null = null

    // Peek: only run AI structuring when content looks messy (chat, summaries, mixed)
    const needsStructure =
      typeof rawFileContent === 'string' &&
      rawFileContent.length > 0 &&
      needsStructureHeuristic(rawFileContent, filename || sessionName || 'file.txt')

    if (needsStructure) {
      try {
        const structured = await structureTranscript(rawFileContent!, language)
        segments = structured.segments
        rawText = structured.rawText
        aiTranscriptSignals = structured.transcriptSignals
      } catch (err: any) {
        console.error('[Import Transcript] AI structuring failed:', err?.message)
        await logError({
          errorType: 'api_error',
          severity: 'error',
          message: `AI structuring failed: ${err?.message || 'Unknown error'}`,
          error: err,
          userId: user.id,
          endpoint: '/api/sessions/import-transcript',
          method: 'POST',
          metadata: {
            step: 'ai_structuring',
            contentLength: rawFileContent?.length,
            filename,
            language,
          },
        }).catch(() => {})
        return NextResponse.json(
          {
            error: 'Failed to structure transcript. Try a cleaner format or use TXT with plain paragraphs.',
          },
          { status: 500 }
        )
      }
    } else if (
      incomingSegments &&
      Array.isArray(incomingSegments) &&
      incomingSegments.length > 0
    ) {
      segments = incomingSegments
      rawText =
        incomingRawText ||
        segments.map((s: ParsedSegment) => s.text).join(' ')
    } else {
      return NextResponse.json(
        { error: 'Segments required and must not be empty' },
        { status: 400 }
      )
    }

    const langCode = language === 'auto' ? 'auto'
      : typeof language === 'string' ? language.slice(0, 2).toLowerCase()
      : 'auto'
    const timestamp = new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const name = sessionName?.trim() || `Transcript ${timestamp}`

    // Compute duration from last segment's timestamp (0 for plain text without timestamps)
    const lastSeg = segments[segments.length - 1]
    const durationSec = lastSeg ? Math.ceil((lastSeg.end_ms || 0) / 1000) : 0

    // Word count for text-only sessions (meaningful when duration is 0)
    const rawTextForCount = incomingRawText || segments.map((s: ParsedSegment) => s.text).join(' ')
    const wordCount = rawTextForCount
      ? rawTextForCount.split(/\s+/).filter((w: string) => w.length > 0).length
      : null

    const sourceSignals = detectImportedTextSource({
      text: rawTextForCount || rawText || '',
      filename,
      sessionName,
      userEmail: profile?.email || null,
      userDisplayName: profile?.display_name || profile?.full_name || null,
    })
    const fallbackTranscriptSignals = detectTranscriptType({
      text: rawTextForCount || rawText || rawFileContent || '',
      filename,
      ingestionSource,
    })
    const transcriptSignals = aiTranscriptSignals || fallbackTranscriptSignals
    const inputHint = sourceSignals.isExternalInquiry ? 'external_inquiry_email' : null
    const seededExtractedContext = {
      sourceSignals,
      transcriptSignals,
      parseStrategy,
    }

    // Create session (no audio)
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        internal_case_id: name,
        status: 'done',
        language: langCode,
        duration_sec: durationSec || null,
        word_count: wordCount,
        ...(inputHint ? { input_hint: inputHint } : {}),
        ai_extracted_context: seededExtractedContext,
      })
      .select()
      .single()

    if (sessionError) {
      await logError({
        errorType: 'api_error',
        severity: 'error',
        message: `Failed to create session: ${sessionError.message}`,
        userId: user.id,
        endpoint: '/api/sessions/import-transcript',
        method: 'POST',
        errorCode: sessionError.code,
        metadata: {
          step: 'session_creation',
          segmentCount: segments.length,
          textLength: rawText?.length,
          language: langCode,
          dbError: sessionError,
        },
      }).catch(() => {})
      return NextResponse.json(
        { error: `Failed to create session: ${sessionError.message}` },
        { status: 500 }
      )
    }

    // PII redaction
    const piiService = createPIIRedactionService()
    const redactionResult = piiService.redact(segments)

    // Insert transcript (file_id null for text import)
    const { error: transcriptError } = await supabase.from('transcripts').insert({
      session_id: session.id,
      file_id: null,
      raw_json: segments,
      redacted_json: redactionResult.redactedSegments,
      raw_text: rawText || segments.map((s: ParsedSegment) => s.text).join(' '),
      redacted_text: redactionResult.redactedText,
      language: langCode,
    })

    if (transcriptError) {
      await logError({
        errorType: 'api_error',
        severity: 'error',
        message: `Failed to save transcript: ${transcriptError.message}`,
        userId: user.id,
        sessionId: session.id,
        endpoint: '/api/sessions/import-transcript',
        method: 'POST',
        errorCode: transcriptError.code,
        metadata: {
          step: 'transcript_insert',
          segmentCount: segments.length,
          rawTextLength: rawText?.length,
          language: langCode,
          dbError: transcriptError,
        },
      }).catch(() => {})
      await supabase.from('sessions').delete().eq('id', session.id)
      return NextResponse.json(
        { error: `Failed to save transcript: ${transcriptError.message}` },
        { status: 500 }
      )
    }

    // Save PII hits if any
    if (redactionResult.piiHits.length > 0) {
      const piiHitsWithSession = redactionResult.piiHits.map((hit: any) => ({
        ...hit,
        session_id: session.id,
      }))
      await supabase.from('pii_hits').insert(piiHitsWithSession)
    }

    // Generate and persist a concise session summary for pasted/uploaded text imports.
    // Best-effort only: summary failures must not block successful imports.
    try {
      const summaryText = await generateImportedContentSummary({
        text: rawText || segments.map((s: ParsedSegment) => s.text).join(' '),
        languageCode: langCode,
      })
      if (summaryText) {
        await supabase
          .from('sessions')
          .update({ speechmatics_summary: summaryText })
          .eq('id', session.id)
      }
    } catch (summaryError: any) {
      console.error('[Import Transcript] Summary generation failed:', summaryError?.message || summaryError)
    }

    // Trigger post-transcribe (analyze + auto-generate) if user has preference
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      'http://localhost:3000'
    const secret = process.env.INTERNAL_API_SECRET
    if (secret) {
      fetch(`${baseUrl}/api/internal/post-transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': secret,
        },
        body: JSON.stringify({ sessionId: session.id }),
      }).catch((err) =>
        console.error('[Import Transcript] Post-transcribe trigger failed:', err)
      )
    }

    return NextResponse.json(
      { success: true, session: { id: session.id, name } },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status >= 500) {
        await logError({
          errorType: 'server_error',
          severity: 'error',
          message: `Import transcript failed: ${error.message}`,
          error,
          endpoint: '/api/sessions/import-transcript',
          method: 'POST',
          metadata: { step: 'unhandled_exception' },
        }).catch(() => {})
      }
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      )
    }
    await logError({
      errorType: 'server_error',
      severity: 'critical',
      message: `Import transcript unknown error: ${String(error)}`,
      error,
      endpoint: '/api/sessions/import-transcript',
      method: 'POST',
      metadata: { step: 'unhandled_exception', rawError: String(error) },
    }).catch(() => {})
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
