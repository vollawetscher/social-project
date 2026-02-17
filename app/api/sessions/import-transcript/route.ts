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
import { logError } from '@/lib/services/error-logger'

interface ParsedSegment {
  start_ms: number
  end_ms: number
  speaker: string
  text: string
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    const {
      language = 'de',
      sessionName,
      segments: incomingSegments,
      rawText: incomingRawText,
      rawFileContent,
      filename,
    }: {
      language?: string
      sessionName?: string
      segments: ParsedSegment[]
      rawText: string
      rawFileContent?: string
      filename?: string
    } = body

    let segments: ParsedSegment[]
    let rawText: string

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

    const langCode = typeof language === 'string' ? language.slice(0, 2).toLowerCase() : 'de'
    const timestamp = new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const name = sessionName?.trim() || `Transcript ${timestamp}`

    // Compute duration from last segment
    const lastSeg = segments[segments.length - 1]
    const durationSec = lastSeg ? Math.ceil((lastSeg.end_ms || 0) / 1000) : 0

    // Create session (no audio)
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        internal_case_id: name,
        status: 'done',
        language: langCode,
        duration_sec: durationSec,
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
