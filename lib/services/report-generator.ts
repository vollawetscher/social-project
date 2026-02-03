import { createClaudeService } from '@/lib/services/claude'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FilePurpose, Transcript } from '@/lib/types/database'

export async function generateReport(
  sessionId: string, 
  supabase: SupabaseClient,
  options?: { recordingIds?: string[]; language?: string }
) {
  console.log('[ReportGenerator] Starting for session:', sessionId)
  if (options?.recordingIds) {
    console.log('[ReportGenerator] Filtering to selected recordings:', options.recordingIds)
  }

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

  // Filter transcripts if specific recordings were selected
  let filteredTranscripts = transcriptsData
  if (options?.recordingIds && options.recordingIds.length > 0) {
    filteredTranscripts = transcriptsData.filter(t => 
      t.file_id && options.recordingIds!.includes(t.file_id)
    )
    console.log(`[ReportGenerator] Filtered to ${filteredTranscripts.length} transcript(s) from selected recordings`)
    
    if (filteredTranscripts.length === 0) {
      throw new Error('No transcripts found for selected recordings')
    }
  }

  // Validate transcripts have required properties
  const invalidTranscripts = filteredTranscripts.filter(t => 
    (!t.raw_text || typeof t.raw_text !== 'string' || t.raw_text.trim().length === 0) &&
    (!t.redacted_text || typeof t.redacted_text !== 'string' || t.redacted_text.trim().length === 0)
  )
  if (invalidTranscripts.length > 0) {
    console.error('[ReportGenerator] Invalid transcripts detected:', invalidTranscripts.map(t => ({
      id: t.id,
      hasRawText: !!t.raw_text,
      hasRedactedText: !!t.redacted_text,
      rawTextLength: t.raw_text?.length || 0,
      redactedTextLength: t.redacted_text?.length || 0
    })))
    throw new Error(`${invalidTranscripts.length} transcript(s) missing text content`)
  }

  console.log(`[ReportGenerator] Found ${filteredTranscripts.length} valid transcript(s)`)

  // Structure transcripts by purpose
  const transcriptsByPurpose: Record<FilePurpose, Transcript[]> = {
    context: [],
    meeting: [],
    dictation: [],
    instruction: [],
    addition: []
  }

  filteredTranscripts.forEach((t: any) => {
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
  
  // Determine language: user selected (options) > session preference > detected (Speechmatics auto)
  // Validate that first transcript exists and has language property
  if (!filteredTranscripts[0]) {
    throw new Error('No transcripts available for language detection')
  }
  
  const detectedLanguage = filteredTranscripts[0].language || 'en'
  const preferredLanguage = options?.language || (session as any).preferred_report_language
  const finalLanguage = preferredLanguage || detectedLanguage
  
  // Validate final language is a valid code
  if (!finalLanguage || typeof finalLanguage !== 'string' || finalLanguage.length < 2) {
    console.warn('[ReportGenerator] Invalid language code, defaulting to English')
    throw new Error('Invalid language configuration')
  }
  
  console.log('[ReportGenerator] Language determination:', {
    detectedBySpeechmatics: detectedLanguage,
    userPreferred: preferredLanguage || 'none (auto)',
    finalLanguage
  })
  
  // Generate generic report with automatic topic detection
  const report = await claudeService.generateReport({
    transcriptsByPurpose,
    sessionMetadata: {
      created_at: session.created_at,
      context_note: (session as any).context_text || session.context_note,  // Prefer new field
      internal_case_id: session.internal_case_id,
      duration_sec: session.duration_sec,
      structured_context: (session as any).structured_context || undefined,
      instructions: (session as any).instructions || undefined,  // Add user instructions
    },
    detectedLanguage: finalLanguage, // Pass final language to Claude
  })

  console.log('[ReportGenerator] Report generated for domain:', report.detected_domain, 'in language:', report.detected_language)

  console.log('[ReportGenerator] Upserting report (create or update)...')
  const { error: upsertError } = await supabase
    .from('reports')
    .upsert({
      session_id: sessionId,
      claude_json: report,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'session_id',
      ignoreDuplicates: false
    })

  if (upsertError) {
    console.error('[ReportGenerator] Failed to upsert report:', upsertError)
    throw new Error('Failed to upsert report: ' + upsertError.message)
  }

  console.log('[ReportGenerator] Report upserted successfully!')

  console.log('[ReportGenerator] Updating session status...')
  await supabase
    .from('sessions')
    .update({ status: 'done' })
    .eq('id', sessionId)

  console.log('[ReportGenerator] Complete!')
  return report
}