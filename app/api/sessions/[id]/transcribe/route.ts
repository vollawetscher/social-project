import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createSpeechmaticsService } from '@/lib/services/speechmatics'
import { createPIIRedactionService } from '@/lib/services/pii-redaction'
import { requireAuth, requireSessionOwnership, handleAuthError } from '@/lib/auth/helpers'

function getInternalBaseUrl(request: Request): string {
  const isRailway = !!(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    process.env.RAILWAY_STATIC_URL
  )

  if (isRailway) {
    const port = process.env.PORT || '8080'
    const baseUrl = `http://localhost:${port}`
    console.log('[Internal URL] Railway detected, using internal URL:', baseUrl)
    return baseUrl
  }

  const origin = new URL(request.url).origin
  const baseUrl = origin.replace('https://localhost', 'http://localhost')
  console.log('[Internal URL] Local/other environment, using:', baseUrl)
  return baseUrl
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionOwnership(params.id, user.id)
    const supabase = createClient()

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, duration_sec')
      .eq('id', params.id)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    await supabase
      .from('sessions')
      .update({ status: 'transcribing' })
      .eq('id', params.id)

    const { data: files } = await supabase
      .from('files')
      .select('storage_path, mime_type')
      .eq('session_id', params.id)
      .limit(1)
      .single()

    if (!files) {
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'No audio file found'
        })
        .eq('id', params.id)

      return NextResponse.json({ error: 'No audio file found' }, { status: 400 })
    }

    console.log('[Transcribe] Downloading audio file from storage:', files.storage_path)
    const { data: audioData, error: downloadError } = await supabase.storage
      .from('rohbericht-audio')
      .download(files.storage_path)

    if (downloadError || !audioData) {
      console.error('[Transcribe] Download error:', downloadError)
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'Failed to download audio file: ' + (downloadError?.message || 'Unknown error')
        })
        .eq('id', params.id)

      return NextResponse.json({
        error: 'Failed to download audio file',
        details: downloadError?.message
      }, { status: 500 })
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
        .eq('id', params.id)

      return NextResponse.json({
        error: 'Audio file too small or empty'
      }, { status: 400 })
    }

    if (session.duration_sec === 0) {
      console.warn('[Transcribe] Session has zero duration, proceeding with caution')
    }

    const audioBuffer = Buffer.from(await audioData.arrayBuffer())
    console.log('[Transcribe] Audio buffer created, size:', audioBuffer.length)

    console.log('[Transcribe] Calling Speechmatics API...')
    const speechmatics = createSpeechmaticsService()
    const transcript = await speechmatics.transcribeAudio(audioBuffer, files.mime_type)
    console.log('[Transcribe] Transcription completed, segments:', transcript.segments.length)

    console.log('[Transcribe] Step 1: Starting PII redaction...')
    const piiService = createPIIRedactionService()
    const redactionResult = piiService.redact(transcript.segments)
    console.log('[Transcribe] Step 1: PII redaction completed, hits found:', redactionResult.piiHits.length)

    console.log('[Transcribe] Step 2: Saving transcript to database...')
    const { error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        session_id: params.id,
        raw_json: transcript.segments,
        redacted_json: redactionResult.redactedSegments,
        raw_text: transcript.fullText,
        redacted_text: redactionResult.redactedText,
        language: transcript.language,
      })

    if (transcriptError) {
      console.error('[Transcribe] Step 2: Failed to save transcript:', transcriptError)
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'Failed to save transcript'
        })
        .eq('id', params.id)

      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 })
    }
    console.log('[Transcribe] Step 2: Transcript saved successfully')

    console.log('[Transcribe] Step 3: Saving PII hits (if any)...')
    if (redactionResult.piiHits.length > 0) {
      const piiHitsWithSession = redactionResult.piiHits.map((hit) => ({
        ...hit,
        session_id: params.id,
      }))

      const { error: piiError } = await supabase
        .from('pii_hits')
        .insert(piiHitsWithSession)

      if (piiError) {
        console.error('[Transcribe] Step 3: Failed to save PII hits:', piiError)
      } else {
        console.log('[Transcribe] Step 3: PII hits saved successfully')
      }
    } else {
      console.log('[Transcribe] Step 3: No PII hits to save')
    }

    console.log('[Transcribe] Step 4: Updating session status to summarizing...')
    await supabase
      .from('sessions')
      .update({ status: 'summarizing' })
      .eq('id', params.id)
    console.log('[Transcribe] Step 4: Session status updated')

    console.log('[Transcribe] Step 5: Calling summarize endpoint...')
    const baseUrl = getInternalBaseUrl(request)
    console.log('[Transcribe] Step 5: Using base URL:', baseUrl)
    const summarizeResponse = await fetch(
      `${baseUrl}/api/sessions/${params.id}/summarize`,
      { method: 'POST' }
    )
    console.log('[Transcribe] Step 5: Summarize endpoint called, status:', summarizeResponse.status)

    if (!summarizeResponse.ok) {
      console.error('[Transcribe] Step 5: Summarize endpoint returned error status:', summarizeResponse.status)
      let errorMessage = 'Failed to generate report'
      try {
        const responseText = await summarizeResponse.text()
        console.error('[Transcribe] Step 5: Summarize endpoint error (raw):', responseText)

        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          errorMessage = responseText || errorMessage
        }
      } catch (e) {
        console.error('[Transcribe] Step 5: Failed to read error response:', e)
      }

      console.error('[Transcribe] Step 5: Setting session to error state with message:', errorMessage)
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: errorMessage
        })
        .eq('id', params.id)
    } else {
      console.log('[Transcribe] Step 5: Summarize endpoint completed successfully!')
    }

    console.log('[Transcribe] All steps completed successfully!')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Transcribe] CRITICAL ERROR - Exception caught:', error)
    console.error('[Transcribe] Error message:', error.message)
    console.error('[Transcribe] Error stack:', error.stack)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401 || authError.status === 403 || authError.status === 404) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }

    const supabase = createClient()
    await supabase
      .from('sessions')
      .update({
        status: 'error',
        last_error: error.message || 'Transcription failed'
      })
      .eq('id', params.id)

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
