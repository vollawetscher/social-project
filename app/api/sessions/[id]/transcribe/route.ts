import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createSpeechmaticsService } from '@/lib/services/speechmatics'
import { recordTranscriptionMinutesFromJob } from '@/lib/services/usage-tracker'
import { createPIIRedactionService } from '@/lib/services/pii-redaction'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { generateReport } from '@/lib/services/report-generator'
import { createErrorLogger } from '@/lib/services/error-logger'

function normalizeVocabCandidate(raw: string): string | null {
  const value = String(raw || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!value) return null
  if (value.length < 2 || value.length > 80) return null
  return value
}

function buildSpeechmaticsAdditionalVocab(input: {
  sessionRow: any
  callContactName?: string | null
  participantNames?: string[]
}): string[] {
  const sessionRow = input.sessionRow || {}
  const extracted = (sessionRow.ai_extracted_context || {}) as Record<string, any>
  const corrections = (sessionRow.transcript_corrections || {}) as Record<string, any>

  const candidates: string[] = []

  if (sessionRow.internal_case_id) candidates.push(String(sessionRow.internal_case_id))
  if (sessionRow.context_note) candidates.push(String(sessionRow.context_note))
  if (sessionRow.context_text) candidates.push(String(sessionRow.context_text))
  if (input.callContactName) candidates.push(String(input.callContactName))
  for (const participantName of input.participantNames || []) {
    candidates.push(String(participantName))
  }

  const participants = Array.isArray(extracted.participants) ? extracted.participants : []
  for (const p of participants) {
    if (typeof p === 'string') candidates.push(p)
    else if (p?.name) candidates.push(String(p.name))
  }

  const topics = Array.isArray(extracted.topics) ? extracted.topics : []
  const agenda = Array.isArray(extracted.agenda) ? extracted.agenda : []
  for (const t of topics) candidates.push(String(t))
  for (const a of agenda) candidates.push(String(a))
  if (extracted.purpose) candidates.push(String(extracted.purpose))
  if (extracted.venue) candidates.push(String(extracted.venue))

  const nameCorrections = corrections.name_corrections || {}
  const wordCorrections = corrections.word_corrections || {}
  for (const v of Object.values(nameCorrections)) candidates.push(String(v))
  for (const v of Object.values(wordCorrections)) candidates.push(String(v))

  // Split long mixed text blobs into phrase-like chunks.
  const flattened = candidates.flatMap((c) => c.split(/[;|•,]/g).map((x) => x.trim()).filter(Boolean))
  const normalized = flattened.map(normalizeVocabCandidate).filter(Boolean) as string[]

  return Array.from(new Set(normalized)).slice(0, 120)
}

/**
 * After the caller's session is transcribed, copy the transcript to any pending
 * callee session that was claimed before transcription completed.
 *
 * Note: if the caller deletes their session before transcription completes,
 * calls.session_id is SET NULL by the FK cascade, and this lookup will find nothing.
 * That case is handled preemptively in the session DELETE handler instead.
 */
async function copyTranscriptToCalleeSession(supabase: any, callerSessionId: string) {
  try {
    const { data: callRow } = await supabase
      .from('calls')
      .select('callee_session_id')
      .eq('session_id', callerSessionId)
      .not('callee_session_id', 'is', null)
      .maybeSingle()

    if (!callRow?.callee_session_id) return

    const { data: calleeSession } = await supabase
      .from('sessions')
      .select('id, is_callee_pending')
      .eq('id', callRow.callee_session_id)
      .maybeSingle()

    if (!calleeSession?.is_callee_pending) return

    console.log('[Transcribe] Found pending callee session, copying transcript:', calleeSession.id)

    // Fetch caller transcripts
    const { data: callerTranscripts } = await supabase
      .from('transcripts')
      .select('*')
      .eq('session_id', callerSessionId)

    // Get callee's file for linking
    const { data: calleeFile } = await supabase
      .from('files')
      .select('id')
      .eq('session_id', calleeSession.id)
      .maybeSingle()

    for (const t of callerTranscripts || []) {
      await supabase.from('transcripts').insert({
        session_id: calleeSession.id,
        file_id: calleeFile?.id ?? null,
        raw_json: t.raw_json,
        redacted_json: t.redacted_json,
        raw_text: t.raw_text,
        redacted_text: t.redacted_text,
        language: t.language,
        summary: t.summary ?? null,
      })
    }

    // Fetch updated caller session stats to copy to callee
    const { data: callerSession } = await supabase
      .from('sessions')
      .select('duration_sec, language, speechmatics_summary')
      .eq('id', callerSessionId)
      .maybeSingle()

    await supabase
      .from('sessions')
      .update({
        status: 'done',
        is_callee_pending: false,
        duration_sec: callerSession?.duration_sec || 0,
        language: callerSession?.language || 'de',
        speechmatics_summary: callerSession?.speechmatics_summary ?? null,
      })
      .eq('id', calleeSession.id)

    console.log('[Transcribe] Callee session transcript copy complete:', calleeSession.id)
  } catch (err: any) {
    console.error('[Transcribe] Failed to copy transcript to callee session:', err.message)
  }
}

// Background job processor - runs independently of HTTP request
// Uses service role to avoid RLS/auth context issues in serverless (no request scope after 202 response)
async function processTranscriptionJob(sessionId: string) {
  const supabase = createServiceRoleClient()
  const errorLogger = await createErrorLogger(supabase)
  
  try {
    // Get session context and language hints for Speechmatics
    const { data: sessionRow } = await supabase
      .from('sessions')
      .select('user_id, input_hint, language, internal_case_id, context_note, context_text, ai_extracted_context, transcript_corrections')
      .eq('id', sessionId)
      .single()
    const inputHint = (sessionRow as any)?.input_hint || ''
    const rawLang = (sessionRow as any)?.language?.slice(0, 2) || null
    const sessionLanguage = rawLang === 'au' ? null : rawLang // 'auto' → null → Speechmatics auto-detect
    const { data: linkedCall } = await supabase
      .from('calls')
      .select('user_id, callee_user_id, contact_name, session_id, callee_session_id')
      .or(`session_id.eq.${sessionId},callee_session_id.eq.${sessionId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const participantUserIds = Array.from(
      new Set(
        [sessionRow?.user_id, linkedCall?.user_id, linkedCall?.callee_user_id]
          .filter(Boolean)
      )
    ) as string[]
    let participantNames: string[] = []
    if (participantUserIds.length > 0) {
      const { data: participantProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, company_name')
        .in('id', participantUserIds)
      participantNames = (participantProfiles || [])
        .map((p: any) => p.display_name || p.full_name || p.company_name)
        .filter((n: any) => typeof n === 'string' && n.trim().length > 0)
    }

    const additionalVocab = buildSpeechmaticsAdditionalVocab({
      sessionRow,
      callContactName: linkedCall?.contact_name || null,
      participantNames,
    })

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

    // Speechmatics does NOT support WebM/Opus - supported: wav, mp3, aac, ogg, mpeg, amr, m4a, mp4, flac
    const webmFiles = files.filter(f => 
      f.mime_type === 'audio/webm' || f.mime_type?.startsWith('audio/webm')
    )
    if (webmFiles.length > 0) {
      const msg = 'WebM format cannot be transcribed. Please convert to MP3 or MP4 first (e.g. cloudconvert.com), or record on iPhone Safari which uses MP4.'
      console.error('[Transcribe] WebM rejected:', webmFiles.map(f => f.storage_path))
      await supabase
        .from('sessions')
        .update({ status: 'error', last_error: msg })
        .eq('id', sessionId)
      return
    }

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`[Transcribe] Processing file ${i + 1}/${files.length}: ${file.storage_path} (${file.file_purpose})`)

      // Delete any existing transcript for this file so retry doesn't silently skip
      const { data: existingTranscript } = await supabase
        .from('transcripts')
        .select('id')
        .eq('file_id', file.id)
        .maybeSingle()

      if (existingTranscript) {
        console.log(`[Transcribe] Deleting existing transcript for file ${file.id} before retry`)
        await supabase.from('transcripts').delete().eq('id', existingTranscript.id)
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
        console.warn('[Transcribe] Audio file too small (empty call):', audioData.size, 'bytes')
        await supabase
          .from('transcripts')
          .insert({
            session_id: sessionId,
            file_id: file.id,
            raw_json: [],
            redacted_json: [],
            raw_text: '',
            redacted_text: '',
            language: sessionLanguage || 'en',
            summary: null,
          })
        await supabase
          .from('sessions')
          .update({
            status: 'done',
            last_error: 'No speech recorded — the call was too short or silent.',
          })
          .eq('id', sessionId)
        return
      }

      const audioBuffer = Buffer.from(await audioData.arrayBuffer())
      console.log('[Transcribe] Audio buffer created, size:', audioBuffer.length)

      const contentType = (inputHint === 'presentation' || inputHint === 'voice_note') ? 'informative' : 'conversational'
      console.log('[Transcribe] Calling Speechmatics API...', { inputHint, contentType, sessionLanguage, additionalVocabCount: additionalVocab.length })
      const speechmatics = createSpeechmaticsService()
      const transcript = await speechmatics.transcribeAudio(audioBuffer, file.mime_type, {
        contentType,
        language: sessionLanguage || undefined,
        additionalVocab,
      })
      console.log('[Transcribe] Transcription completed, segments:', transcript.segments.length)

      if (transcript.segments.length === 0) {
        console.warn('[Transcribe] No speech detected in audio for file:', file.storage_path)
      }

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
          summary: transcript.summary || null,
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

    // Update session language from detected transcript only when user did not select one at upload
    const { data: sessionBefore } = await supabase
      .from('sessions')
      .select('language')
      .eq('id', sessionId)
      .single()

    const userSelectedLang = (sessionBefore as any)?.language
    const shouldUpdateFromTranscript = !userSelectedLang || userSelectedLang === 'auto'

    if (shouldUpdateFromTranscript) {
      const { data: firstTranscript } = await supabase
        .from('transcripts')
        .select('language')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const detectedLanguage = firstTranscript?.language
      if (detectedLanguage && typeof detectedLanguage === 'string' && detectedLanguage.length >= 2 && detectedLanguage !== 'auto') {
        await supabase
          .from('sessions')
          .update({ language: detectedLanguage.slice(0, 2).toLowerCase() })
          .eq('id', sessionId)
        console.log(`[Transcribe] Session language set from transcript: ${detectedLanguage}`)
      } else {
        console.warn(`[Transcribe] Could not determine detected language from transcript (got: ${detectedLanguage}), session language remains as-is`)
      }
    } else {
      console.log(`[Transcribe] Keeping user-selected language: ${userSelectedLang}`)
    }

    // Update session with Speechmatics summary (concatenate all transcript summaries for multi-file)
    const { data: transcriptSummaries } = await supabase
      .from('transcripts')
      .select('summary')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    const summaries = (transcriptSummaries || [])
      .map((t: any) => t?.summary?.trim())
      .filter(Boolean)
    if (summaries.length > 0) {
      const mergedSummary = summaries.join('\n\n')
      await supabase
        .from('sessions')
        .update({ speechmatics_summary: mergedSummary })
        .eq('id', sessionId)
      console.log(`[Transcribe] Session speechmatics_summary set (${summaries.length} part(s))`)
    }

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

    // If a callee claimed this call before transcription finished, copy the transcript now
    await copyTranscriptToCalleeSession(supabase, sessionId)

    console.log('[Transcribe] All steps completed successfully!')
  } catch (error: any) {
    console.error('[Transcribe] CRITICAL ERROR - Exception caught:', error)
    console.error('[Transcribe] Error message:', error.message)
    console.error('[Transcribe] Error stack:', error.stack)

    const supabase = createServiceRoleClient()
    
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
    // Allow internal calls (e.g. from LiveKit webhook) via x-internal-secret header.
    // If INTERNAL_API_SECRET is not set, also allow through (dev / Railway without secret).
    const expectedSecret = process.env.INTERNAL_API_SECRET
    const providedSecret = request.headers.get('x-internal-secret')
    const isInternalCall = !expectedSecret || providedSecret === expectedSecret

    if (!isInternalCall) {
      const user = await requireAuth()
      await requireSessionAccess(params.id, user.id)
    }
    const supabase = isInternalCall ? createServiceRoleClient() : await createClient()
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

    const expectedSecret = process.env.INTERNAL_API_SECRET
    const providedSecret = request.headers.get('x-internal-secret')
    const isInternalCall = !expectedSecret || providedSecret === expectedSecret
    const supabase = isInternalCall ? createServiceRoleClient() : await createClient()
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
