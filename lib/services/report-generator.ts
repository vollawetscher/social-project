import { createClaudeService } from '@/lib/services/claude'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FilePurpose, Transcript } from '@/lib/types/database'

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

  console.log('[ReportGenerator] Fetching all transcripts with file information...')
  const { data: transcriptsData, error: transcriptError } = await supabase
    .from('transcripts')
    .select(`
      *,
      files:file_id (
        id,
        file_purpose,
        created_at
      )
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (transcriptError || !transcriptsData || transcriptsData.length === 0) {
    console.error('[ReportGenerator] No transcripts found:', transcriptError)
    throw new Error('No transcripts found')
  }

  console.log(`[ReportGenerator] Found ${transcriptsData.length} transcript(s)`)

  // Structure transcripts by purpose
  const transcriptsByPurpose: Record<FilePurpose, Transcript[]> = {
    context: [],
    meeting: [],
    dictation: [],
    instruction: [],
    addition: []
  }

  transcriptsData.forEach((t: any) => {
    const purpose: FilePurpose = t.files?.file_purpose || 'meeting'
    transcriptsByPurpose[purpose].push(t)
  })

  console.log('[ReportGenerator] Transcripts by purpose:', {
    context: transcriptsByPurpose.context.length,
    meeting: transcriptsByPurpose.meeting.length,
    dictation: transcriptsByPurpose.dictation.length,
    instruction: transcriptsByPurpose.instruction.length,
    addition: transcriptsByPurpose.addition.length
  })

  console.log('[ReportGenerator] Calling Claude API with structured transcripts...')
  const claudeService = createClaudeService()
  
  // Get language from first transcript (detected by Speechmatics)
  const detectedLanguage = transcriptsData[0]?.language || 'en'
  console.log('[ReportGenerator] Using language detected by Speechmatics:', detectedLanguage)
  
  // Generate generic report with automatic topic detection
  const report = await claudeService.generateReport({
    transcriptsByPurpose,
    sessionMetadata: {
      created_at: session.created_at,
      context_note: session.context_note,
      internal_case_id: session.internal_case_id,
      duration_sec: session.duration_sec,
    },
    detectedLanguage, // Pass Speechmatics language to Claude
  })

  console.log('[ReportGenerator] Report generated for domain:', report.detected_domain, 'in language:', report.detected_language)

  console.log('[ReportGenerator] Fetching existing report ID (if any)...')
  const { data: existingReport } = await supabase
    .from('reports')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (existingReport) {
    console.log('[ReportGenerator] Updating existing report...')
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        claude_json: report,
        created_at: new Date().toISOString(),
      })
      .eq('id', existingReport.id)

    if (updateError) {
      console.error('[ReportGenerator] Failed to update report:', updateError)
      throw new Error('Failed to update report')
    }
  } else {
    console.log('[ReportGenerator] Creating new report...')
    const { error: insertError } = await supabase
      .from('reports')
      .insert({
        session_id: sessionId,
        claude_json: report,
      })

    if (insertError) {
      console.error('[ReportGenerator] Failed to insert report:', insertError)
      throw new Error('Failed to insert report')
    }
  }

  console.log('[ReportGenerator] Updating session status...')
  await supabase
    .from('sessions')
    .update({ status: 'done' })
    .eq('id', sessionId)

  console.log('[ReportGenerator] Complete!')
  return report
}