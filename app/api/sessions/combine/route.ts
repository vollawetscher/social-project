import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { mergeTranscripts } from '@/lib/utils/merge-transcripts'

type Segment = {
  start_ms?: number
  end_ms?: number
  text?: string
  speaker?: string
  [key: string]: unknown
}

const asSegmentArray = (value: unknown): Segment[] =>
  Array.isArray(value) ? (value as Segment[]) : []

function offsetSegments(segments: Segment[], offsetMs: number): Segment[] {
  return segments.map((seg) => ({
    ...seg,
    start_ms: (seg.start_ms ?? 0) + offsetMs,
    end_ms: (seg.end_ms ?? 0) + offsetMs,
  }))
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const rawIds = Array.isArray(body?.sessionIds) ? body.sessionIds : []
    const sessionIds: string[] = Array.from(new Set(rawIds.filter((id: unknown): id is string => typeof id === 'string')))
    const requestedName = typeof body?.name === 'string' ? body.name.trim() : ''

    if (sessionIds.length < 2) {
      return NextResponse.json({ error: 'At least two sessions are required' }, { status: 400 })
    }

    for (const id of sessionIds) {
      await requireSessionAccess(id, user.id)
    }

    const db = createServiceRoleClient()

    const { data: sourceSessions, error: sessionsError } = await db
      .from('sessions')
      .select('id, internal_case_id, language, created_at, merged_into_session_id')
      .in('id', sessionIds)

    if (sessionsError || !sourceSessions || sourceSessions.length !== sessionIds.length) {
      return NextResponse.json({ error: 'Failed to load source sessions' }, { status: 500 })
    }

    if (sourceSessions.some((s: any) => s.merged_into_session_id)) {
      return NextResponse.json({ error: 'One or more sessions are already merged' }, { status: 400 })
    }

    const orderedSessions = [...sourceSessions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const { data: transcripts, error: transcriptsError } = await db
      .from('transcripts')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })

    if (transcriptsError || !transcripts?.length) {
      return NextResponse.json({ error: 'No transcripts found for selected sessions' }, { status: 400 })
    }

    const transcriptsBySession = new Map<string, any[]>()
    for (const t of transcripts) {
      const arr = transcriptsBySession.get(t.session_id) || []
      arr.push(t)
      transcriptsBySession.set(t.session_id, arr)
    }

    let offsetMs = 0
    const mergedRaw: Segment[] = []
    const mergedRedacted: Segment[] = []
    const rawTextParts: string[] = []
    const redactedTextParts: string[] = []

    for (const session of orderedSessions) {
      const rows = transcriptsBySession.get(session.id) || []
      if (!rows.length) continue
      const mergedSessionTranscript = mergeTranscripts(rows)
      if (!mergedSessionTranscript) continue

      const rawSegments = asSegmentArray(mergedSessionTranscript.raw_json)
      const redactedSegments = asSegmentArray(mergedSessionTranscript.redacted_json).length
        ? asSegmentArray(mergedSessionTranscript.redacted_json)
        : rawSegments

      mergedRaw.push(...offsetSegments(rawSegments, offsetMs))
      mergedRedacted.push(...offsetSegments(redactedSegments, offsetMs))
      rawTextParts.push(mergedSessionTranscript.raw_text || '')
      redactedTextParts.push(mergedSessionTranscript.redacted_text || mergedSessionTranscript.raw_text || '')

      const lastSeg = rawSegments[rawSegments.length - 1]
      offsetMs += lastSeg?.end_ms ?? 0
    }

    if (!mergedRaw.length) {
      return NextResponse.json({ error: 'No transcript segments available to combine' }, { status: 400 })
    }

    const firstSession = orderedSessions[0]
    const defaultName = `Combined ${new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`

    const { data: combinedSession, error: createSessionError } = await db
      .from('sessions')
      .insert({
        user_id: user.id,
        internal_case_id: requestedName || defaultName,
        status: 'done',
        language: firstSession.language || 'auto',
        duration_sec: Math.ceil(offsetMs / 1000),
      })
      .select('id')
      .single()

    if (createSessionError || !combinedSession) {
      return NextResponse.json({ error: 'Failed to create combined session' }, { status: 500 })
    }

    const { error: transcriptInsertError } = await db.from('transcripts').insert({
      session_id: combinedSession.id,
      file_id: null,
      raw_json: mergedRaw,
      redacted_json: mergedRedacted,
      raw_text: rawTextParts.filter(Boolean).join('\n\n'),
      redacted_text: redactedTextParts.filter(Boolean).join('\n\n'),
      language: firstSession.language || 'auto',
    })

    if (transcriptInsertError) {
      await db.from('sessions').delete().eq('id', combinedSession.id)
      return NextResponse.json({ error: 'Failed to create combined transcript' }, { status: 500 })
    }

    const { error: sourceUpdateError } = await db
      .from('sessions')
      .update({ merged_into_session_id: combinedSession.id })
      .in('id', sessionIds)

    if (sourceUpdateError) {
      // Roll back combined session so source sessions are not left visible and unlinked.
      await db.from('transcripts').delete().eq('session_id', combinedSession.id)
      await db.from('sessions').delete().eq('id', combinedSession.id)
      return NextResponse.json({ error: 'Failed to finalize merge' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sessionId: combinedSession.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
