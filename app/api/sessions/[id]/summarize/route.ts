import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createClaudeService } from '@/lib/services/claude'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Summarize] Starting summarization for session:', params.id)
    const supabase = createClient()

    console.log('[Summarize] Step 1: Fetching session data...')
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (sessionError || !session) {
      console.error('[Summarize] Step 1: Session not found:', sessionError)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    console.log('[Summarize] Step 1: Session fetched successfully')

    console.log('[Summarize] Step 2: Fetching transcript...')
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('*')
      .eq('session_id', params.id)
      .single()

    if (transcriptError || !transcript) {
      console.error('[Summarize] Step 2: No transcript found:', transcriptError)
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'No transcript found'
        })
        .eq('id', params.id)

      return NextResponse.json({ error: 'No transcript found' }, { status: 400 })
    }
    console.log('[Summarize] Step 2: Transcript fetched successfully')

    console.log('[Summarize] Step 3: Calling Claude API to generate report...')
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
    console.log('[Summarize] Step 3: Claude report generated successfully')

    console.log('[Summarize] Step 4: Saving report to database...')
    const { error: reportError } = await supabase
      .from('reports')
      .insert({
        session_id: params.id,
        claude_json: rohbericht,
      })

    if (reportError) {
      console.error('[Summarize] Step 4: Failed to save report:', reportError)
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'Failed to save report'
        })
        .eq('id', params.id)

      return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
    }
    console.log('[Summarize] Step 4: Report saved successfully')

    console.log('[Summarize] Step 5: Updating session status to done...')
    await supabase
      .from('sessions')
      .update({ status: 'done' })
      .eq('id', params.id)
    console.log('[Summarize] Step 5: Session marked as done!')

    return NextResponse.json({ success: true, rohbericht })
  } catch (error: any) {
    console.error('[Summarize] CRITICAL ERROR - Exception caught:', error)
    console.error('[Summarize] Error message:', error.message)
    console.error('[Summarize] Error stack:', error.stack)

    const supabase = createClient()

    const errorMessage = error.message || 'Report generation failed'
    const detailedError = error.stack ? `${errorMessage}\n${error.stack}` : errorMessage

    await supabase
      .from('sessions')
      .update({
        status: 'error',
        last_error: errorMessage
      })
      .eq('id', params.id)

    return NextResponse.json(
      { error: errorMessage, details: error.stack },
      { status: 500 }
    )
  }
}
