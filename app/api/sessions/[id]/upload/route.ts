import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const duration = parseInt(formData.get('duration') as string || '0', 10)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('[Upload] Received file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      duration: duration
    })

    if (file.size < 1024) {
      return NextResponse.json(
        { error: 'Die Datei ist zu klein und scheint leer oder beschädigt zu sein.' },
        { status: 400 }
      )
    }

    const supportedMimeTypes = [
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/ogg',
      'audio/aac',
      'audio/flac',
      'audio/x-m4a'
    ]

    const isSupported = supportedMimeTypes.some(type => file.type.toLowerCase().includes(type.split(';')[0]))

    if (!isSupported && file.type) {
      console.warn('[Upload] Unsupported MIME type received:', file.type)
      console.warn('[Upload] Proceeding anyway, but transcription may fail')
    }

    if (duration < 0) {
      return NextResponse.json(
        { error: 'Ungültige Audiodauer' },
        { status: 400 }
      )
    }

    if (duration === 0) {
      console.warn('[Upload] Audio uploaded with zero duration, may fail transcription:', {
        sessionId: params.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      })
    }

    await supabase
      .from('sessions')
      .update({ status: 'uploading' })
      .eq('id', params.id)

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const storagePath = `sessions/${params.id}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('rohbericht-audio')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'Upload failed: ' + uploadError.message
        })
        .eq('id', params.id)

      return NextResponse.json(
        { error: 'Upload failed: ' + uploadError.message },
        { status: 500 }
      )
    }

    const { error: fileRecordError } = await supabase
      .from('files')
      .insert({
        session_id: params.id,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
      })

    if (fileRecordError) {
      await supabase.storage
        .from('rohbericht-audio')
        .remove([storagePath])

      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: 'Failed to record file metadata'
        })
        .eq('id', params.id)

      return NextResponse.json(
        { error: 'Failed to record file metadata' },
        { status: 500 }
      )
    }

    await supabase
      .from('sessions')
      .update({
        status: 'created',
        duration_sec: duration
      })
      .eq('id', params.id)

    return NextResponse.json({
      success: true,
      storage_path: storagePath,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
