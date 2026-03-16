import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { parseTranscriptFile, type TranscriptParseStrategy } from '@/lib/utils/transcript-parser'
import { createPIIRedactionService } from '@/lib/services/pii-redaction'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)
    const db = createServiceRoleClient()

    const body = await request.json().catch(() => ({}))
    const strategy = (body?.strategy || 'auto') as TranscriptParseStrategy

    const { data: transcripts, error: transcriptError } = await db
      .from('transcripts')
      .select('*')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    if (transcriptError) {
      return NextResponse.json({ error: transcriptError.message }, { status: 500 })
    }
    if (!transcripts || transcripts.length === 0) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }
    if (transcripts.length > 1) {
      return NextResponse.json(
        { error: 'Re-parse currently supports sessions with a single transcript row only.' },
        { status: 409 }
      )
    }

    const transcript = transcripts[0]
    const rawSegments = Array.isArray(transcript.raw_json) ? transcript.raw_json : []
    const reconstructedFromSegments = rawSegments
      .map((s: any) => `${s?.speaker || 'S1'}: ${s?.text || ''}`)
      .join('\n')
      .trim()
    // Prefer structured segment-derived source for re-parse to preserve speaker boundaries.
    const sourceText =
      reconstructedFromSegments ||
      (transcript.raw_text as string | null) ||
      ''

    const { data: sessionData } = await db
      .from('sessions')
      .select('ai_extracted_context')
      .eq('id', params.id)
      .maybeSingle()
    const participantHints = Array.isArray((sessionData as any)?.ai_extracted_context?.participants)
      ? (sessionData as any).ai_extracted_context.participants
          .map((p: any) => (typeof p === 'string' ? p : p?.name))
          .filter((name: any): name is string => typeof name === 'string' && name.trim().length > 1)
      : []

    if (!sourceText || sourceText.length < 10) {
      return NextResponse.json({ error: 'Transcript text is empty' }, { status: 400 })
    }

    const parsed = parseTranscriptFile(sourceText, 'reparse.txt', {
      strategy,
      speakerHints: participantHints,
    })
    if (!parsed.segments.length) {
      return NextResponse.json({ error: 'Parser produced no segments' }, { status: 400 })
    }

    const piiService = createPIIRedactionService()
    const redactionResult = piiService.redact(parsed.segments)

    const { error: updateTranscriptError } = await db
      .from('transcripts')
      .update({
        raw_json: parsed.segments,
        redacted_json: redactionResult.redactedSegments,
        raw_text: parsed.rawText,
        redacted_text: redactionResult.redactedText,
      })
      .eq('id', transcript.id)

    if (updateTranscriptError) {
      return NextResponse.json({ error: updateTranscriptError.message }, { status: 500 })
    }

    const last = parsed.segments[parsed.segments.length - 1]
    await db
      .from('sessions')
      .update({
        duration_sec: Math.ceil((last?.end_ms || 0) / 1000) || null,
      })
      .eq('id', params.id)

    return NextResponse.json({
      success: true,
      transcript: {
        ...transcript,
        raw_json: parsed.segments,
        redacted_json: redactionResult.redactedSegments,
        raw_text: parsed.rawText,
        redacted_text: redactionResult.redactedText,
      },
      strategy,
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

