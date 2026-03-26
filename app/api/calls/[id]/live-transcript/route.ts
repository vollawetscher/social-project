import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const callId = params.id
    const afterParam = new URL(request.url).searchParams.get('after')
    const after = afterParam ? Number(afterParam) : 0

    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id')
      .eq('id', callId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    let query = supabase
      .from('call_live_transcript_lines')
      .select('id, source_key, speaker_label, text, is_final, timestamp_ms, created_at')
      .eq('call_id', callId)
      .order('timestamp_ms', { ascending: true })
      .limit(200)

    if (after > 0) {
      query = query.gt('timestamp_ms', after)
    }

    const { data, error } = await query
    if (error) throw error

    const lines = (data || []).map((row: any) => ({
      id: row.id,
      speakerKey: row.source_key,
      speakerLabel: row.speaker_label,
      text: row.text,
      timestampMs: Number(row.timestamp_ms) || Date.now(),
      isFinal: Boolean(row.is_final),
    }))
    const latestTimestampMs = lines.length > 0 ? lines[lines.length - 1].timestampMs : after

    return NextResponse.json({
      lines,
      latestTimestampMs,
    })
  } catch (error: any) {
    console.error('[Live Transcript API] Error:', error)
    return NextResponse.json({ error: 'Failed to load live transcript' }, { status: 500 })
  }
}
