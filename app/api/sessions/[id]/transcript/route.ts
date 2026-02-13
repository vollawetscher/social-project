import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'

function mergeTranscripts(transcripts: any[]): any {
  if (transcripts.length === 0) return null
  if (transcripts.length === 1) return transcripts[0]

  let timeOffset = 0
  const mergedRawJson: any[] = []
  const mergedRedactedJson: any[] = []
  const rawTextParts: string[] = []
  const redactedTextParts: string[] = []

  for (const t of transcripts) {
    const segments = (t.raw_json || []) as { start_ms?: number; end_ms?: number; [k: string]: any }[]
    const redactedSegments = (t.redacted_json || t.raw_json || []) as { start_ms?: number; end_ms?: number; [k: string]: any }[]
    for (const seg of segments) {
      mergedRawJson.push({
        ...seg,
        start_ms: (seg.start_ms ?? 0) + timeOffset,
        end_ms: (seg.end_ms ?? 0) + timeOffset,
      })
    }
    for (const seg of redactedSegments) {
      mergedRedactedJson.push({
        ...seg,
        start_ms: (seg.start_ms ?? 0) + timeOffset,
        end_ms: (seg.end_ms ?? 0) + timeOffset,
      })
    }
    rawTextParts.push(t.raw_text || '')
    redactedTextParts.push(t.redacted_text || t.raw_text || '')
    const lastSeg = segments[segments.length - 1]
    timeOffset += lastSeg?.end_ms ?? 0
  }

  return {
    ...transcripts[0],
    id: transcripts[0].id,
    raw_json: mergedRawJson,
    redacted_json: mergedRedactedJson,
    raw_text: rawTextParts.filter(Boolean).join('\n\n'),
    redacted_text: redactedTextParts.filter(Boolean).join('\n\n'),
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)
    const supabase = await createClient()

    const { data: transcripts, error } = await supabase
      .from('transcripts')
      .select('*')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    if (error || !transcripts?.length) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    const merged = mergeTranscripts(transcripts)
    return NextResponse.json(merged)
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
