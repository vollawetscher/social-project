import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createClaudeService } from '@/lib/services/claude'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (sessionError || !session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('*')
      .eq('session_id', params.id)
      .single()

    if (transcriptError || !transcript) {
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'No transcript found'
        })
        .eq('id', params.id)

      return NextResponse.json({ error: 'No transcript found' }, { status: 400 })
    }

    const claudeService = createClaudeService()

    const rohbericht = await claudeService.generateRohbericht({
      redactedSegments: transcript.redacted_json,
      redactedText: transcript.redacted_text,
      sessionMetadata: {
        created_at: session.created_at,
        context_note: session.context_note,
        internal_case_id: session.internal_case_id,
        duration_sec: session.duration_sec,
      },
    })

    const { error: reportError } = await supabase
      .from('reports')
      .insert({
        session_id: params.id,
        claude_json: rohbericht,
      })

    if (reportError) {
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'Failed to save report'
        })
        .eq('id', params.id)

      return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
    }

    await supabase
      .from('sessions')
      .update({ status: 'done' })
      .eq('id', params.id)

    return NextResponse.json({ success: true, rohbericht })
  } catch (error: any) {
    const supabase = createClient()
    await supabase
      .from('sessions')
      .update({
        status: 'error',
        last_error: error.message || 'Report generation failed'
      })
      .eq('id', params.id)

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
