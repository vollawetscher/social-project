import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { logError } from '@/lib/services/error-logger'
import { getStorageMimeType } from '@/lib/utils/audio-format-detector'

export const maxDuration = 120

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)
    const supabase = await createClient()

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
    const filePurpose = (formData.get('purpose') as string || 'meeting') as 'context' | 'meeting' | 'dictation' | 'instruction' | 'addition'
    const recordedAtParam = formData.get('recorded_at') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file purpose
    const validPurposes = ['context', 'meeting', 'dictation', 'instruction', 'addition']
    if (!validPurposes.includes(filePurpose)) {
      return NextResponse.json({ error: 'Invalid file purpose' }, { status: 400 })
    }

    console.log('[Upload] Received file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      duration: duration,
      purpose: filePurpose
    })

    if (file.size < 1024) {
      return NextResponse.json(
        { error: 'Die Datei ist zu klein und scheint leer oder beschädigt zu sein.' },
        { status: 400 }
      )
    }

    // Speechmatics-compatible formats only
    // See: https://docs.speechmatics.com/introduction/supported-languages
    // Supported: wav, mp3, aac, ogg, mpeg, amr, m4a, mp4, flac
    // NOT supported: webm
    // video/mp4: iOS recordings and downloaded .mp4 files often report this (same container as audio/mp4)
    const supportedMimeTypes = [
      'audio/mp4',
      'video/mp4',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/ogg',
      'application/ogg',  // some browsers report OGG files with this MIME type
      'audio/aac',
      'audio/flac',
      'audio/x-m4a',
      'audio/amr'
    ]

    const normalizedFileType = file.type.toLowerCase().split(/[;:]/)[0].trim()
    const isSupported = supportedMimeTypes.some(type =>
      normalizedFileType === type || normalizedFileType.startsWith(type + '/')
    )

    console.log('[Upload] MIME type validation:', {
      original: file.type,
      normalized: normalizedFileType,
      isSupported
    })

    // Reject WebM explicitly as Speechmatics doesn't support it
    if (normalizedFileType === 'audio/webm') {
      console.error('[Upload] WebM format rejected - not supported by Speechmatics')
      return NextResponse.json(
        { 
          error: 'WebM-Format wird nicht unterstützt. Bitte verwenden Sie MP3, MP4, WAV oder OGG. Laden Sie die Seite neu, um das richtige Format zu verwenden.' 
        },
        { status: 400 }
      )
    }

    if (!isSupported && file.type) {
      console.warn('[Upload] Unsupported MIME type received:', file.type)
      return NextResponse.json(
        { 
          error: `Audioformat "${file.type}" wird nicht unterstützt. Unterstützte Formate: MP3, MP4, WAV, OGG, AAC, FLAC, M4A` 
        },
        { status: 400 }
      )
    }

    if (duration < 0) {
      return NextResponse.json(
        { error: 'Ungültige Audiodauer' },
        { status: 400 }
      )
    }

    // Enforce minimum duration of 1 second for valid audio
    if (duration === 0) {
      console.error('[Upload] Audio rejected: zero duration indicates invalid audio file:', {
        sessionId: params.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      })
      return NextResponse.json(
        { error: 'Audiodatei ist ungültig (keine Audiodauer erkannt). Bitte überprüfen Sie die Datei.' },
        { status: 400 }
      )
    }

    // Warn about very short audio (< 2 seconds) but allow it
    if (duration > 0 && duration < 2) {
      console.warn('[Upload] Very short audio detected (<2s), may not transcribe well:', {
        sessionId: params.id,
        fileName: file.name,
        duration,
      })
    }

    await supabase
      .from('sessions')
      .update({ status: 'uploading' })
      .eq('id', params.id)

    const fileExt = (file.name.split('.').pop() || 'mp3').toLowerCase()
    const fileName = `${Date.now()}.${fileExt}`
    const storagePath = `sessions/${params.id}/${fileName}`

    // Use extension-based MIME for phone recordings (browser often reports wrong/empty)
    const storageContentType = getStorageMimeType(file)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('rohbericht-audio')
      .upload(storagePath, buffer, {
        contentType: storageContentType,
        upsert: false,
      })

    if (uploadError) {
      const isMaxSize = uploadError.message?.toLowerCase().includes('maximum allowed size') ||
        uploadError.message?.toLowerCase().includes('exceeded') ||
        uploadError.message?.toLowerCase().includes('too large')
      const sizeMB = Math.round(file.size / 1024 / 1024)
      const errorMessage = isMaxSize
        ? `File too large (${sizeMB} MB). Maximum upload size is 500 MB.`
        : 'Upload failed: ' + uploadError.message
      
      // Log error for tracking
      await logError({
        errorType: 'api_error',
        severity: 'error',
        message: errorMessage,
        error: uploadError,
        sessionId: params.id,
        userId: user.id,
        endpoint: '/api/sessions/[id]/upload',
        method: 'POST',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
      })

      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: errorMessage
        })
        .eq('id', params.id)

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    const { error: fileRecordError } = await supabase
      .from('files')
      .insert({
        session_id: params.id,
        storage_path: storagePath,
        mime_type: storageContentType,
        size_bytes: file.size,
        file_purpose: filePurpose,
      })

    if (fileRecordError) {
      const errorMessage = 'Failed to record file metadata'
      
      // Log error for tracking
      await logError({
        errorType: 'api_error',
        severity: 'error',
        message: errorMessage,
        error: fileRecordError,
        sessionId: params.id,
        userId: user.id,
        endpoint: '/api/sessions/[id]/upload',
        method: 'POST',
        metadata: {
          storagePath,
          fileName: file.name,
        },
      })

      await supabase.storage
        .from('rohbericht-audio')
        .remove([storagePath])

      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: errorMessage
        })
        .eq('id', params.id)

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    const { data: { publicUrl } } = supabase.storage
      .from('rohbericht-audio')
      .getPublicUrl(storagePath)

    const updatePayload: Record<string, unknown> = {
      status: 'created',
      duration_sec: duration,
      audio_url: publicUrl,
    }
    if (recordedAtParam) {
      const parsed = new Date(recordedAtParam)
      if (!isNaN(parsed.getTime())) updatePayload.recorded_at = parsed.toISOString()
    } else if (file.lastModified && file.lastModified > 0) {
      updatePayload.recorded_at = new Date(file.lastModified).toISOString()
    }
    await supabase
      .from('sessions')
      .update(updatePayload)
      .eq('id', params.id)

    return NextResponse.json({
      success: true,
      storage_path: storagePath,
    })
  } catch (error) {
    if (error instanceof Error) {
      // Log the error for tracking
      try {
        const user = await requireAuth().catch(() => null)
        if (user) {
          await logError({
            errorType: 'server_error',
            severity: 'error',
            message: error.message,
            error,
            sessionId: params.id,
            userId: user.id,
            endpoint: '/api/sessions/[id]/upload',
            method: 'POST',
          })
        }
      } catch (logErr) {
        console.error('Failed to log error:', logErr)
      }

      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
