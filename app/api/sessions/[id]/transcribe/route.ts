import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createSpeechmaticsService } from '@/lib/services/speechmatics'
import { createPIIRedactionService } from '@/lib/services/pii-redaction'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
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

    const audioBuffer = Buffer.from(await audioData.arrayBuffer())
    console.log('[Transcribe] Audio buffer created, size:', audioBuffer.length)

    console.log('[Transcribe] Calling Speechmatics API...')
    const speechmatics = createSpeechmaticsService()
    const transcript = await speechmatics.transcribeAudio(audioBuffer, files.mime_type)
    console.log('[Transcribe] Transcription completed, segments:', transcript.segments.length)

    const piiService = createPIIRedactionService()
    const redactionResult = piiService.redact(transcript.segments)

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
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'Failed to save transcript'
        })
        .eq('id', params.id)

      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 })
    }

    if (redactionResult.piiHits.length > 0) {
      const piiHitsWithSession = redactionResult.piiHits.map((hit) => ({
        ...hit,
        session_id: params.id,
      }))

      await supabase
        .from('pii_hits')
        .insert(piiHitsWithSession)
    }

    await supabase
      .from('sessions')
      .update({ status: 'summarizing' })
      .eq('id', params.id)

    const baseUrl = new URL(request.url).origin
    const summarizeResponse = await fetch(
      `${baseUrl}/api/sessions/${params.id}/summarize`,
      { method: 'POST' }
    )

    if (!summarizeResponse.ok) {
      let errorMessage = 'Failed to generate report'
      try {
        const responseText = await summarizeResponse.text()
        console.error('Summarize endpoint error (raw):', responseText)

        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          errorMessage = responseText || errorMessage
        }
      } catch (e) {
        console.error('Failed to read error response:', e)
      }

      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: errorMessage
        })
        .eq('id', params.id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
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
