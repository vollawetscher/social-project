/**
 * POST /api/sessions/import-transcript
 *
 * Create a session from uploaded transcript text (TXT, SRT, VTT).
 * Skips audio/transcription; inserts transcript directly and triggers analyze + auto-generate if configured.
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createPIIRedactionService } from '@/lib/services/pii-redaction'

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
      segments,
      rawText,
    }: {
      language?: string
      sessionName?: string
      segments: ParsedSegment[]
      rawText: string
    } = body

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
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
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
