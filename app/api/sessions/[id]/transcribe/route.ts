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

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', params.id)
      .single()

    if (sessionError || !session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    const { data: audioData, error: downloadError } = await supabase.storage
      .from('rohbericht-audio')
      .download(files.storage_path)

    if (downloadError || !audioData) {
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'Failed to download audio file'
        })
        .eq('id', params.id)

      return NextResponse.json({ error: 'Failed to download audio file' }, { status: 500 })
    }

    const audioBuffer = Buffer.from(await audioData.arrayBuffer())

    const speechmatics = createSpeechmaticsService()
    const transcript = await speechmatics.transcribeAudio(audioBuffer, files.mime_type)

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

    const summarizeResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sessions/${params.id}/summarize`,
      { method: 'POST' }
    )

    if (!summarizeResponse.ok) {
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'Failed to generate report'
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
