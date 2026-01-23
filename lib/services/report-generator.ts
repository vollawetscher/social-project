import { createClaudeService } from '@/lib/services/claude'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function generateReport(sessionId: string, supabase: SupabaseClient) {
  console.log('[ReportGenerator] Starting for session:', sessionId)

  console.log('[ReportGenerator] Fetching session data...')
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError || !session) {
    console.error('[ReportGenerator] Session not found:', sessionError)
    throw new Error('Session not found')
  }

  console.log('[ReportGenerator] Fetching transcript...')
  const { data: transcript, error: transcriptError } = await supabase
    .from('transcripts')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (transcriptError || !transcript) {
    console.error('[ReportGenerator] No transcript found:', transcriptError)
    throw new Error('No transcript found')
  }

  console.log('[ReportGenerator] Calling Claude API with RAW transcript (unredacted)...')
  const claudeService = createClaudeService()
  const gespraechsbericht = await claudeService.generateGespraechsbericht({
    redactedSegments: transcript.raw_json, // Changed: Use raw instead of redacted
    redactedText: transcript.raw_text, // Changed: Use raw instead of redacted
    sessionMetadata: {
      created_at: session.created_at,
      context_note: session.context_note,
      internal_case_id: session.internal_case_id,
      duration_sec: session.duration_sec,
    },
  })

  console.log('[ReportGenerator] Saving report...')
  const { error: reportError } = await supabase
    .from('reports')
    .insert({
      session_id: sessionId,
      claude_json: gespraechsbericht,
    })

  if (reportError) {
    console.error('[ReportGenerator] Failed to save report:', reportError)
    throw new Error('Failed to save report')
  }

  console.log('[ReportGenerator] Updating session status...')
  await supabase
    .from('sessions')
    .update({ status: 'done' })
    .eq('id', sessionId)

  console.log('[ReportGenerator] Complete!')
  return gespraechsbericht
}