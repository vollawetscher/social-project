import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createSpeechmaticsService } from '@/lib/services/speechmatics'
import { recordTranscriptionMinutesFromJob } from '@/lib/services/usage-tracker'
import { createPIIRedactionService } from '@/lib/services/pii-redaction'
import { requireAuth, requireSessionOwnership, handleAuthError } from '@/lib/auth/helpers'
import { generateReport } from '@/lib/services/report-generator'
import { createErrorLogger } from '@/lib/services/error-logger'

// Background job processor - runs independently of HTTP request
async function processTranscriptionJob(sessionId: string) {
  const supabase = await createClient()
  const errorLogger = await createErrorLogger(supabase)
  
  try {
    // Get all files for this session
    const { data: files } = await supabase
      .from('files')
      .select('id, storage_path, mime_type, file_purpose')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (!files || files.length === 0) {
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'No audio files found'
        })
        .eq('id', sessionId)
      return
    }

    console.log(`[Transcribe] Found ${files.length} file(s) to transcribe`)

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`[Transcribe] Processing file ${i + 1}/${files.length}: ${file.storage_path} (${file.file_purpose})`)

      // Check if transcript already exists for this file
      const { data: existingTranscript } = await supabase
        .from('transcripts')
        .select('id')
        .eq('file_id', file.id)
        .maybeSingle()

      if (existingTranscript) {
        console.log(`[Transcribe] Transcript already exists for file ${file.id}, skipping`)
        continue
      }

      console.log('[Transcribe] Downloading audio file from storage:', file.storage_path)
      const { data: audioData, error: downloadError } = await supabase.storage
        .from('rohbericht-audio')
        .download(file.storage_path)

      if (downloadError || !audioData) {
        console.error('[Transcribe] Download error:', downloadError)
        await supabase
          .from('sessions')
          .update({
            status: 'error',
            last_error: 'Failed to download audio file: ' + (downloadError?.message || 'Unknown error')
          })
          .eq('id', sessionId)
        return
      }

      console.log('[Transcribe] Audio file downloaded successfully, size:', audioData.size)

      if (audioData.size < 1024) {
        console.error('[Transcribe] Audio file too small:', audioData.size)
        await supabase
          .from('sessions')
          .update({
            status: 'error',
            last_error: 'Die Audiodatei ist zu klein oder leer. Bitte laden Sie eine gültige Audiodatei hoch.'
          })
          .eq('id', sessionId)
        return
      }

      const audioBuffer = Buffer.from(await audioData.arrayBuffer())
      console.log('[Transcribe] Audio buffer created, size:', audioBuffer.length)

      console.log('[Transcribe] Calling Speechmatics API...')
      const speechmatics = createSpeechmaticsService()
      const transcript = await speechmatics.transcribeAudio(audioBuffer, file.mime_type)
      console.log('[Transcribe] Transcription completed, segments:', transcript.segments.length)

      console.log(`[Transcribe] Step 1 (File ${i + 1}): Starting PII redaction...`)
      const piiService = createPIIRedactionService()
      const redactionResult = piiService.redact(transcript.segments)
      console.log(`[Transcribe] Step 1 (File ${i + 1}): PII redaction completed, hits found:`, redactionResult.piiHits.length)

      console.log(`[Transcribe] Step 2 (File ${i + 1}): Saving transcript to database...`)
      const { error: transcriptError } = await supabase
        .from('transcripts')
        .insert({
          session_id: sessionId,
          file_id: file.id,
          raw_json: transcript.segments,
          redacted_json: redactionResult.redactedSegments,
          raw_text: transcript.fullText,
          redacted_text: redactionResult.redactedText,
          language: transcript.language,
        })

      if (transcriptError) {
        console.error(`[Transcribe] Step 2 (File ${i + 1}): Failed to save transcript:`, transcriptError)
        await supabase
          .from('sessions')
          .update({
            status: 'error',
            last_error: 'Failed to save transcript'
          })
          .eq('id', sessionId)
        return
      }
      console.log(`[Transcribe] Step 2 (File ${i + 1}): Transcript saved successfully`)

      console.log(`[Transcribe] Step 3 (File ${i + 1}): Saving PII hits (if any)...`)
      if (redactionResult.piiHits.length > 0) {
        const piiHitsWithSession = redactionResult.piiHits.map((hit) => ({
          ...hit,
          session_id: sessionId,
        }))

        const { error: piiError } = await supabase
          .from('pii_hits')
          .insert(piiHitsWithSession)

        if (piiError) {
          console.error(`[Transcribe] Step 3 (File ${i + 1}): Failed to save PII hits:`, piiError)
        } else {
          console.log(`[Transcribe] Step 3 (File ${i + 1}): PII hits saved successfully`)
        }
      } else {
        console.log(`[Transcribe] Step 3 (File ${i + 1}): No PII hits to save`)
      }
    }

    console.log('[Transcribe] All files processed successfully')

    // Get session info and user preferences
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('duration_sec, user_id')
      .eq('id', sessionId)
      .single()

    const sessionDuration = sessionData?.duration_sec || 0
    const userId = sessionData?.user_id

    // Record transcription minutes for usage tracking (beta cost calculation)
    if (sessionDuration > 0) {
      recordTranscriptionMinutesFromJob(userId, sessionDuration / 60, { sessionId })
    }

    // Get user's report generation preferences (legacy + new template-based)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('auto_generate_reports, after_transcript_template_id, after_transcript_action')
      .eq('id', userId)
      .single()

    const autoGenerateReports = userProfile?.auto_generate_reports || false
    const afterTranscriptTemplateId = (userProfile as any)?.after_transcript_template_id
    const legacyAction = userProfile?.after_transcript_action && userProfile.after_transcript_action !== 'nothing'

    // Check if any of the transcribed files were "meeting" type
    const hasMeetingRecording = files.some(f => f.file_purpose === 'meeting')

    // NEW: If user has "After transcript: use template X" in Settings, trigger analyze + auto-generate
    if (afterTranscriptTemplateId || legacyAction) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'http://localhost:3000'
      const secret = process.env.INTERNAL_API_SECRET
      if (secret) {
        console.log('[Transcribe] Triggering post-transcribe (analyze + auto-generate)...')
        fetch(`${baseUrl}/api/internal/post-transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': secret,
          },
          body: JSON.stringify({ sessionId }),
        }).catch(err => console.error('[Transcribe] Post-transcribe trigger failed:', err))
      } else {
        console.warn('[Transcribe] INTERNAL_API_SECRET not set - skipping post-transcribe')
      }
    }

    // LEGACY: Only auto-generate report if user has old auto_generate_reports enabled
    // AND it's a meeting recording with meaningful duration (30+ seconds)
    const shouldGenerateReport = 
      autoGenerateReports && 
      hasMeetingRecording && 
      sessionDuration >= 30

    if (shouldGenerateReport) {
      console.log(`[Transcribe] User has auto-report enabled, meeting recording found (${sessionDuration}s) - generating report...`)
      
      console.log('[Transcribe] Step 4: Updating session status to summarizing...')
      await supabase
        .from('sessions')
        .update({ status: 'summarizing' })
        .eq('id', sessionId)
      console.log('[Transcribe] Step 4: Session status updated')

      console.log('[Transcribe] Step 5: Generating report...')
      try {
        await generateReport(sessionId, supabase)
        console.log('[Transcribe] Step 5: Report generated successfully!')
      } catch (error: any) {
        console.error('[Transcribe] Step 5: Report generation failed:', error.message)
        await supabase
          .from('sessions')
          .update({
            status: 'error',
            last_error: error.message
          })
          .eq('id', sessionId)
      }
    } else {
      // Transcription complete, no automatic report
      if (!autoGenerateReports) {
        console.log('[Transcribe] User has auto-report disabled - skipping report generation')
      } else if (!hasMeetingRecording) {
        console.log('[Transcribe] No meeting recording found - skipping report generation')
      } else if (sessionDuration < 30) {
        console.log(`[Transcribe] Meeting recording too short (${sessionDuration}s) - skipping report generation`)
      }
      
      console.log('[Transcribe] Updating session status to done (transcription only)...')
      await supabase
        .from('sessions')
        .update({ status: 'done' })
        .eq('id', sessionId)
      console.log('[Transcribe] Session marked as done - user can manually generate report if needed')
    }

    console.log('[Transcribe] All steps completed successfully!')
  } catch (error: any) {
    console.error('[Transcribe] CRITICAL ERROR - Exception caught:', error)
    console.error('[Transcribe] Error message:', error.message)
    console.error('[Transcribe] Error stack:', error.stack)

    const supabase = await createClient()
    
    // Get case_id for error logging
    const { data: session } = await supabase
      .from('sessions')
      .select('case_id, user_id')
      .eq('id', sessionId)
      .single()

    // Log error to database for AI analysis
    await errorLogger.log({
      errorType: 'server_error',
      severity: 'critical',
      message: error.message || 'Transcription failed',
      error,
      sessionId,
      caseId: session?.case_id,
      userId: session?.user_id,
      endpoint: '/api/sessions/[id]/transcribe',
      metadata: {
        step: 'transcription_job',
        sessionId,
      },
    })

    await supabase
      .from('sessions')
      .update({
        status: 'error',
        last_error: error.message || 'Transcription failed'
      })
      .eq('id', sessionId)
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionOwnership(params.id, user.id)
    const supabase = await createClient()
    const errorLogger = await createErrorLogger(supabase)

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, duration_sec, case_id')
      .eq('id', params.id)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Set status to transcribing
    await supabase
      .from('sessions')
      .update({ status: 'transcribing' })
      .eq('id', params.id)

    // Start background job (fire and forget)
    console.log('[Transcribe] Starting background job for session:', params.id)
    processTranscriptionJob(params.id).catch(err => {
      console.error('[Transcribe] Background job failed:', err)
    })

    // Return immediately with 202 Accepted
    return NextResponse.json(
      { 
        success: true, 
        message: 'Transcription job started',
        status: 'transcribing'
      },
      { status: 202 }
    )
  } catch (error: any) {
    console.error('[Transcribe] Failed to start job:', error)

    const supabase = await createClient()
    const errorLogger = await createErrorLogger(supabase)

    // Get session context for error logging
    const { data: session } = await supabase
      .from('sessions')
      .select('case_id, user_id')
      .eq('id', params.id)
      .maybeSingle()

    // Log error for debugging
    await errorLogger.logFromRequest(error, request, {
      sessionId: params.id,
      caseId: session?.case_id,
      userId: session?.user_id,
      errorCode: '500',
    })

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401 || authError.status === 403 || authError.status === 404) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to start transcription' },
      { status: 500 }
    )
  }
}
