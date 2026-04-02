import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createSpeechmaticsService } from '@/lib/services/speechmatics'
import { recordTranscriptionMinutesFromJob } from '@/lib/services/usage-tracker'
import { createPIIRedactionService } from '@/lib/services/pii-redaction'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { generateReport } from '@/lib/services/report-generator'
import { createErrorLogger } from '@/lib/services/error-logger'
import { enqueueAsyncJob, triggerAsyncWorker, linkJobToSession } from '@/lib/services/queue'
import { logPipelineEvent } from '@/lib/services/pipeline-logger'
import { alignTranscripts } from '@/lib/services/transcript-aligner'
import { prependVoiceSample } from '@/lib/services/voice-sample-prepend'

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

function compactSpeechmaticsSummary(raw: string): string {
  const normalized = String(raw || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!normalized) return ''

  const MAX_BULLETS = 8
  const MAX_CHARS = 1200
  const bulletLike = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => /^[-*•]\s+/.test(line))

  let points: string[] = []
  if (bulletLike) {
    points = normalized
      .split('\n')
      .map((line) => line.trim().replace(/^[-*•]\s+/, ''))
      .filter(Boolean)
  } else {
    points = normalized
      .split(/\n+/)
      .flatMap((block) => block.split(/(?<=[.!?])\s+/))
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const deduped = Array.from(new Set(points))
    .filter((item) => item.length >= 8)
    .slice(0, MAX_BULLETS)

  if (deduped.length === 0) return normalized.slice(0, MAX_CHARS)

  let compact = deduped.map((item) => `- ${item}`).join('\n')
  if (compact.length > MAX_CHARS) {
    compact = `${compact.slice(0, MAX_CHARS - 1).trimEnd()}…`
  }
  return compact
}

function isExpectedNoSpeechError(error: unknown): boolean {
  const message = String((error as any)?.message || '').toLowerCase()
  if (!message) return false
  return (
    message.includes('no usable speech') ||
    message.includes('contains no usable speech') ||
    message.includes('contains no speech') ||
    message.includes('audio file is too short') ||
    message.includes('audio is too short') ||
    message.includes('could not detect the language') ||
    (message.includes('too short') && message.includes('transcription')) ||
    (message.includes('too short') && message.includes('speech'))
  )
}

function formatStorageError(error: unknown): string {
  if (!error) return 'unknown'
  if (error instanceof Error) return error.message || 'unknown'
  if (typeof error === 'string') return error
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.message === 'string' && obj.message) return obj.message
    const code = typeof obj.code === 'string' ? obj.code : null
    const statusCode = typeof obj.statusCode === 'number' ? String(obj.statusCode) : null
    const pieces = [code, statusCode].filter(Boolean)
    if (pieces.length > 0) return pieces.join(' ')
    try {
      return JSON.stringify(obj)
    } catch {
      return 'unknown'
    }
  }
  return String(error)
}

function inferTrackKindFromStoragePath(path: string | null | undefined): 'a' | 'b' | null {
  const value = String(path || '')
  if (!value) return null
  if (value.includes('_track_a.')) return 'a'
  if (value.includes('_track_b.')) return 'b'
  return null
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
      .select('user_id, input_hint, language, internal_case_id, context_note, context_text, ai_extracted_context, transcript_corrections, user_is_speaker')
      .eq('id', sessionId)
      .single()
    const inputHint = (sessionRow as any)?.input_hint || ''
    const userIsSpeaker = (sessionRow as any)?.user_is_speaker === true
    const rawLang = (sessionRow as any)?.language?.slice(0, 2) || null
    const sessionLanguage = rawLang === 'au' ? null : rawLang // 'auto' → null → Speechmatics auto-detect
    const requestedLanguageRaw = (sessionRow as any)?.language || null
    const requestedLanguageMode = sessionLanguage ? 'fixed' : 'auto'
    await logPipelineEvent({
      sessionId,
      userId: (sessionRow as any)?.user_id || null,
      stage: 'transcribe',
      event: 'job_started',
      metadata: {
        inputHint: (sessionRow as any)?.input_hint || null,
        requestedLanguage: requestedLanguageRaw,
        speechmaticsLanguageConfig: sessionLanguage || 'auto',
        languageMode: requestedLanguageMode,
      },
    }, supabase)
    const { data: linkedCall } = await supabase
      .from('calls')
      .select('id, user_id, callee_user_id, contact_name, session_id, callee_session_id, call_type, pstn_transcription_mode, room_created_at_ms, track_a_started_at_ns, track_b_started_at_ns, started_at, ended_at')
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
        .select('id, display_name')
        .in('id', participantUserIds)
      participantNames = (participantProfiles || [])
        .map((p: any) => p.display_name)
        .filter((n: any) => typeof n === 'string' && n.trim().length > 0)
    }

    const additionalVocab = buildSpeechmaticsAdditionalVocab({
      sessionRow,
      callContactName: linkedCall?.contact_name || null,
      participantNames,
    })

    let voiceSampleBuffer: Buffer | null = null
    let voiceSampleMime = 'audio/ogg'
    let voiceSampleDurationMs = 0
    let voiceSampleUserName: string | null = null
    const sessionUserId = (sessionRow as any)?.user_id
    if (sessionUserId && userIsSpeaker) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', sessionUserId)
        .single()
      voiceSampleUserName = userProfile?.display_name || null

      const sampleLang = sessionLanguage || null
      let voiceSampleRow = null
      if (sampleLang) {
        const { data } = await supabase
          .from('voice_samples')
          .select('storage_path, duration_ms, language')
          .eq('user_id', sessionUserId)
          .eq('language', sampleLang)
          .maybeSingle()
        voiceSampleRow = data
      }

      if (voiceSampleRow?.storage_path && voiceSampleRow.duration_ms) {
        voiceSampleDurationMs = voiceSampleRow.duration_ms
        const { data: vsData, error: vsError } = await supabase.storage
          .from('rohbericht-audio')
          .download(voiceSampleRow.storage_path)
        if (vsData) {
          voiceSampleBuffer = Buffer.from(await vsData.arrayBuffer())
          voiceSampleMime = voiceSampleRow.storage_path.endsWith('.webm') ? 'audio/webm' : 'audio/ogg'
          console.log('[Transcribe] Voice sample loaded:', voiceSampleBuffer.length, 'bytes,', voiceSampleDurationMs, 'ms, lang:', voiceSampleRow.language, '(session:', sampleLang || 'auto', ')')
        } else {
          console.error('[Transcribe] Voice sample download failed:', vsError?.message, 'path:', voiceSampleRow.storage_path)
          await logPipelineEvent({
            sessionId,
            userId: sessionUserId,
            stage: 'transcribe',
            event: 'voice_sample_download_failed',
            severity: 'warning',
            metadata: { storagePath: voiceSampleRow.storage_path, error: vsError?.message || 'no data returned' },
          }, supabase)
        }
      } else if (sampleLang) {
        console.log('[Transcribe] No voice sample found for language:', sampleLang)
        await logPipelineEvent({
          sessionId,
          userId: sessionUserId,
          stage: 'transcribe',
          event: 'voice_sample_not_found',
          severity: 'info',
          metadata: { language: sampleLang },
        }, supabase)
      }
    } else if (sessionUserId && !userIsSpeaker) {
      console.log('[Transcribe] Skipping voice sample — user is not a speaker in this recording')
    }

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
    const hasTrackAFile = files.some((f) => inferTrackKindFromStoragePath(f.storage_path) === 'a')
    const hasTrackBFile = files.some((f) => inferTrackKindFromStoragePath(f.storage_path) === 'b')
    const dualTrackTranscription =
      linkedCall?.call_type === 'pstn_outbound' &&
      (linkedCall as any)?.pstn_transcription_mode === 'live' &&
      hasTrackAFile &&
      hasTrackBFile &&
      Number.isFinite(Number((linkedCall as any)?.room_created_at_ms))

    let trackASegments: any[] = []
    let trackBSegments: any[] = []
    let trackALanguage: string | null = null
    let trackBLanguage: string | null = null
    let dualSummaries: string[] = []
    if (dualTrackTranscription) {
      console.log('[Transcribe] Dual-track mode detected, resetting session transcripts before re-build')
      await supabase
        .from('transcripts')
        .delete()
        .eq('session_id', sessionId)
    }

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
      let audioData: Blob | null = null
      const { data: downloadedAudio, error: downloadError } = await supabase.storage
        .from('rohbericht-audio')
        .download(file.storage_path)
      audioData = downloadedAudio || null

      if (downloadError || !audioData) {
        // Fallback: signed URL fetch can recover from intermittent SDK download failures.
        console.warn('[Transcribe] Primary storage download failed, trying signed URL fallback:', {
          storagePath: file.storage_path,
          error: formatStorageError(downloadError),
        })
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('rohbericht-audio')
          .createSignedUrl(file.storage_path, 120)
        if (!signedUrlError && signedUrlData?.signedUrl) {
          try {
            const signedRes = await fetch(signedUrlData.signedUrl, { method: 'GET' })
            if (signedRes.ok) {
              audioData = await signedRes.blob()
              console.log('[Transcribe] Signed URL fallback download succeeded:', file.storage_path)
            } else {
              console.warn('[Transcribe] Signed URL fallback failed with non-OK status:', signedRes.status)
            }
          } catch (fallbackFetchError) {
            console.warn('[Transcribe] Signed URL fallback fetch failed:', formatStorageError(fallbackFetchError))
          }
        } else {
          console.warn('[Transcribe] Failed to create signed URL fallback:', formatStorageError(signedUrlError))
        }
      }

      if (!audioData) {
        const reason = formatStorageError(downloadError)
        console.error('[Transcribe] Download error:', {
          storagePath: file.storage_path,
          reason,
          raw: downloadError,
        })
        await supabase
          .from('sessions')
          .update({
            status: 'error',
            last_error: `Failed to download audio file (${file.storage_path}): ${reason}`
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

      let audioBuffer = Buffer.from(await audioData.arrayBuffer())
      console.log('[Transcribe] Audio buffer created, size:', audioBuffer.length)

      let voiceSamplePrepended = false
      let effectiveVoiceSampleDurationMs = 0
      if (voiceSampleBuffer && voiceSampleDurationMs > 0) {
        console.log('[Transcribe] Attempting voice sample prepend, sample:', voiceSampleBuffer.length, 'bytes, audio:', audioBuffer.length, 'bytes, sampleMime:', voiceSampleMime, 'audioMime:', file.mime_type)
        const prepended = await prependVoiceSample(
          voiceSampleBuffer,
          voiceSampleMime,
          audioBuffer,
          file.mime_type,
        )
        if (prepended) {
          audioBuffer = prepended.buffer
          voiceSamplePrepended = true
          effectiveVoiceSampleDurationMs = voiceSampleDurationMs
          console.log('[Transcribe] Voice sample prepended, new size:', audioBuffer.length, 'offset:', voiceSampleDurationMs, 'ms')
          await logPipelineEvent({
            sessionId,
            userId: (sessionRow as any)?.user_id || null,
            stage: 'transcribe',
            event: 'voice_sample_prepended',
            metadata: { durationMs: voiceSampleDurationMs, userName: voiceSampleUserName, originalSize: audioBuffer.length },
          }, supabase)
        } else {
          console.error('[Transcribe] Voice sample prepend FAILED — ffmpeg concat returned null')
          await logPipelineEvent({
            sessionId,
            userId: (sessionRow as any)?.user_id || null,
            stage: 'transcribe',
            event: 'voice_sample_prepend_failed',
            severity: 'warning',
            metadata: { sampleMime: voiceSampleMime, audioMime: file.mime_type, sampleSize: voiceSampleBuffer.length, audioSize: audioBuffer.length },
          }, supabase)
        }
      }

      const contentType = (inputHint === 'presentation' || inputHint === 'voice_note') ? 'informative' : 'conversational'
      const effectiveMime = voiceSamplePrepended ? 'audio/ogg' : file.mime_type
      console.log('[Transcribe] Calling Speechmatics API...', { inputHint, contentType, sessionLanguage, additionalVocabCount: additionalVocab.length, voiceSamplePrepended })
      const speechmatics = createSpeechmaticsService()

      let transcript
      try {
        transcript = await speechmatics.transcribeAudio(audioBuffer, effectiveMime, {
          contentType,
          language: sessionLanguage || undefined,
          additionalVocab,
          voiceSampleOffsetMs: voiceSamplePrepended ? effectiveVoiceSampleDurationMs : undefined,
        })
        await logPipelineEvent({
          sessionId,
          userId: (sessionRow as any)?.user_id || null,
          stage: 'transcribe',
          event: 'speechmatics_job_completed',
          metadata: {
            fileId: file.id,
            speechmaticsJobId: transcript.jobId || null,
            language: transcript.language || null,
            speechmaticsRequestedLanguage: transcript.requestedLanguage || sessionLanguage || 'auto',
            segmentCount: transcript.segments?.length || 0,
          },
        }, supabase)
      } catch (transcribeError: any) {
        if (!isExpectedNoSpeechError(transcribeError)) {
          await logPipelineEvent({
            sessionId,
            userId: (sessionRow as any)?.user_id || null,
            stage: 'transcribe',
            event: 'speechmatics_job_failed',
            severity: 'error',
            metadata: {
              fileId: file.id,
              speechmaticsRequestedLanguage: sessionLanguage || 'auto',
              message: String(transcribeError?.message || 'unknown'),
            },
          }, supabase)
          throw transcribeError
        }

        // Treat low/no-speech audio as a successful no-content transcription result.
        console.warn('[Transcribe] Expected no-speech outcome for file:', file.storage_path, transcribeError?.message)
        const { data: existingNoSpeechTranscript } = await supabase
          .from('transcripts')
          .select('id')
          .eq('file_id', file.id)
          .maybeSingle()

        if (!existingNoSpeechTranscript) {
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
        }
        await logPipelineEvent({
          sessionId,
          userId: (sessionRow as any)?.user_id || null,
          stage: 'transcribe',
          event: 'speechmatics_no_speech_handled',
          severity: 'warning',
          metadata: {
            fileId: file.id,
            speechmaticsRequestedLanguage: sessionLanguage || 'auto',
          },
        }, supabase)
        continue
      }

      console.log('[Transcribe] Transcription completed, segments:', transcript.segments.length)

      if (voiceSamplePrepended && effectiveVoiceSampleDurationMs > 0 && transcript.segments.length > 0) {
        const primedSpeaker = transcript.primedSpeaker || null
        if (primedSpeaker && voiceSampleUserName) {
          for (const seg of transcript.segments) {
            if (seg.speaker === primedSpeaker) {
              seg.speaker = voiceSampleUserName
            }
          }
          transcript.fullText = transcript.segments.map((s) => s.text).join(' ')
        }
        console.log('[Transcribe] Voice sample stripped at word level, offset:', effectiveVoiceSampleDurationMs, 'ms, primed speaker:', primedSpeaker, '→', voiceSampleUserName)
        await logPipelineEvent({
          sessionId,
          userId: (sessionRow as any)?.user_id || null,
          stage: 'transcribe',
          event: 'voice_sample_speaker_identified',
          metadata: {
            primedSpeaker,
            userName: voiceSampleUserName,
            offsetMs: effectiveVoiceSampleDurationMs,
            segmentsAfterOffset: transcript.segments.length,
          },
        }, supabase)
      }

      const trackKind = inferTrackKindFromStoragePath(file.storage_path)

      if (transcript.segments.length === 0) {
        console.warn('[Transcribe] No speech detected in audio for file:', file.storage_path)
      }

      if (dualTrackTranscription && trackKind) {
        if (trackKind === 'a') {
          trackASegments = transcript.segments
          trackALanguage = transcript.language || trackALanguage
        } else {
          trackBSegments = transcript.segments
          trackBLanguage = transcript.language || trackBLanguage
        }
        if (transcript.summary) dualSummaries.push(transcript.summary)
        console.log(`[Transcribe] Buffered dual-track transcript for track ${trackKind.toUpperCase()}`)
        continue
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

    if (dualTrackTranscription) {
      const roomCreatedAtMs = Number((linkedCall as any)?.room_created_at_ms || 0)
      const trackAStartedAtNs = Number((linkedCall as any)?.track_a_started_at_ns || 0)
      const trackBStartedAtNs = Number((linkedCall as any)?.track_b_started_at_ns || 0)
      if (!trackASegments.length || !trackBSegments.length) {
        throw new Error('Dual-track merge failed: missing participant transcript data')
      }
      if (!roomCreatedAtMs || !trackAStartedAtNs || !trackBStartedAtNs) {
        throw new Error('Dual-track merge failed: missing track timing metadata')
      }

      const aligned = alignTranscripts({
        trackASegments,
        trackBSegments,
        trackAStartedAtNs,
        trackBStartedAtNs,
        roomCreatedAtMs,
        participantAName: participantNames[0] || 'Participant A',
        participantBName: linkedCall?.contact_name || participantNames[1] || 'Participant B',
      })
      const piiService = createPIIRedactionService()
      const redactionResult = piiService.redact(aligned.segments as any)
      const mergedSummary = dualSummaries.length > 0
        ? compactSpeechmaticsSummary(dualSummaries.join('\n\n'))
        : null

      const { error: mergedInsertError } = await supabase
        .from('transcripts')
        .insert({
          session_id: sessionId,
          file_id: null,
          raw_json: aligned.segments,
          redacted_json: redactionResult.redactedSegments,
          raw_text: aligned.fullText,
          redacted_text: redactionResult.redactedText,
          language: (trackALanguage || trackBLanguage || sessionLanguage || 'en').slice(0, 2),
          summary: mergedSummary,
        })
      if (mergedInsertError) {
        throw new Error(`Failed to save merged dual-track transcript: ${mergedInsertError.message}`)
      }
      if (redactionResult.piiHits.length > 0) {
        const piiHitsWithSession = redactionResult.piiHits.map((hit) => ({
          ...hit,
          session_id: sessionId,
        }))
        const { error: piiError } = await supabase
          .from('pii_hits')
          .insert(piiHitsWithSession)
        if (piiError) {
          console.error('[Transcribe] Failed to save merged PII hits:', piiError)
        }
      }
      console.log('[Transcribe] Dual-track merge and save completed')
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
      const mergedSummary = compactSpeechmaticsSummary(summaries.join('\n\n'))
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

    let sessionDuration = sessionData?.duration_sec || 0
    const userId = sessionData?.user_id

    // Fallback: compute duration from call timestamps when egress reported 0
    if (sessionDuration === 0 && linkedCall?.started_at && linkedCall?.ended_at) {
      const startMs = new Date(linkedCall.started_at).getTime()
      const endMs = new Date(linkedCall.ended_at).getTime()
      if (endMs > startMs) {
        sessionDuration = Math.round((endMs - startMs) / 1000)
        await supabase
          .from('sessions')
          .update({ duration_sec: sessionDuration })
          .eq('id', sessionId)
        console.log(`[Transcribe] Duration fallback from call window: ${sessionDuration}s`)
      }
    }

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

    // Always trigger post-transcribe to enqueue analysis (and auto-generate if configured)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000'
    const secret = process.env.INTERNAL_API_SECRET
    if (secret) {
      console.log('[Transcribe] Triggering post-transcribe for session:', sessionId)
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

    // Mark linked call as done now that transcription is complete
    if (linkedCall?.id) {
      await supabase
        .from('calls')
        .update({ status: 'done' })
        .eq('id', linkedCall.id)
      console.log('[Transcribe] Call marked as done:', linkedCall.id)
    }

    console.log('[Transcribe] All steps completed successfully!')
    await logPipelineEvent({
      sessionId,
      userId: sessionData?.user_id || null,
      stage: 'transcribe',
      event: 'job_completed',
      metadata: {
        durationSec: sessionDuration || 0,
        fileCount: files.length,
        requestedLanguage: requestedLanguageRaw,
        speechmaticsLanguageConfig: sessionLanguage || 'auto',
        languageMode: requestedLanguageMode,
      },
    }, supabase)
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
    await logPipelineEvent({
      sessionId,
      userId: session?.user_id || null,
      caseId: session?.case_id || null,
      stage: 'transcribe',
      event: 'job_failed',
      severity: 'critical',
      metadata: {
        message: String(error?.message || 'unknown'),
      },
    }, supabase)
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const queueMode = String((body as any)?.queueMode || '').toLowerCase()

    // Allow internal calls (e.g. from LiveKit webhook) via x-internal-secret header.
    // If INTERNAL_API_SECRET is not set, also allow through (dev / Railway without secret).
    const expectedSecret = process.env.INTERNAL_API_SECRET
    const providedSecret = request.headers.get('x-internal-secret')
    const isInternalCall = !expectedSecret || providedSecret === expectedSecret

    if (!isInternalCall) {
      const user = await requireAuth(request)
      await requireSessionAccess(params.id, user.id)
    }
    const supabase = isInternalCall ? createServiceRoleClient() : await createClient()
    const errorLogger = await createErrorLogger(supabase)

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, user_id, duration_sec, case_id, language')
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

    const forceSync = queueMode === 'sync' || request.headers.get('x-queue-worker') === '1'
    if (!forceSync) {
      if (!(session as any).user_id) {
        return NextResponse.json({ error: 'Session user missing' }, { status: 400 })
      }
      const job = await enqueueAsyncJob({
        userId: (session as any).user_id,
        jobType: 'session_transcribe',
        payload: { sessionId: params.id },
        idempotencyKey: `session_transcribe:${params.id}`,
        maxAttempts: 5,
      })
      await linkJobToSession(job.id, params.id)
      triggerAsyncWorker()
      await logPipelineEvent({
        sessionId: params.id,
        userId: (session as any).user_id || null,
        caseId: (session as any).case_id || null,
        stage: 'transcribe',
        event: 'job_enqueued',
        metadata: {
          asyncJobId: job.id,
          requestedLanguage: (session as any).language || null,
          languageMode: (session as any).language && (session as any).language !== 'auto' ? 'fixed' : 'auto',
        },
      }, supabase)
      return NextResponse.json(
        {
          success: true,
          queued: true,
          message: 'Transcription job queued',
          status: 'transcribing',
          jobId: job.id,
        },
        { status: 202 }
      )
    }

    console.log('[Transcribe] Running sync worker job for session:', params.id)
    await processTranscriptionJob(params.id)
    const { data: updatedSession } = await supabase
      .from('sessions')
      .select('status, last_error')
      .eq('id', params.id)
      .maybeSingle()
    if (updatedSession?.status === 'error') {
      return NextResponse.json(
        {
          error: updatedSession.last_error || 'Transcription failed',
          status: 'error',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Transcription completed',
        status: updatedSession?.status || 'done'
      },
      { status: 200 }
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
