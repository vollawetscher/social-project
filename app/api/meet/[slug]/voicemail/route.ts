import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const maxDuration = 60

/**
 * POST /api/meet/[slug]/voicemail — Accept a voice message from an unauthenticated visitor.
 *
 * Multipart form: file (audio blob), visitorName, visitorEmail (optional)
 * Creates a session owned by the meeting link owner, uploads audio, triggers transcription.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    if (!slug || slug.length < 2) {
      return NextResponse.json({ error: 'Invalid meeting link' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const visitorName = String(formData.get('visitorName') || '').trim() || 'Guest'
    const visitorEmail = formData.get('visitorEmail') ? String(formData.get('visitorEmail')).trim() : null

    if (!file || file.size < 1024) {
      return NextResponse.json({ error: 'No audio file provided or file too small' }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: owner, error: ownerError } = await supabase
      .from('profiles')
      .select('id, display_name, meeting_slug')
      .eq('meeting_slug', slug.toLowerCase())
      .maybeSingle()

    if (ownerError || !owner) {
      return NextResponse.json({ error: 'Meeting room not found' }, { status: 404 })
    }

    const contextParts = [`Voice message from ${visitorName}`]
    if (visitorEmail) contextParts.push(`Email: ${visitorEmail}`)

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: owner.id,
        status: 'uploading',
        context_note: contextParts.join('\n'),
        internal_case_id: `Voice message from ${visitorName}`,
        duration_sec: 0,
        last_error: '',
        input_hint: 'voice_message',
        language: 'auto',
        user_is_speaker: false,
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      console.error('[Voicemail] Session creation failed:', sessionError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    const sessionId = session.id
    const timestamp = Date.now()
    const ext = inferExtension(file.type)
    const storagePath = `sessions/${sessionId}/voicemail_${timestamp}.${ext}`
    const storageMime = normalizeAudioMime(file.type)

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('rohbericht-audio')
      .upload(storagePath, buffer, {
        contentType: storageMime,
        upsert: false,
      })

    if (uploadError) {
      console.error('[Voicemail] Storage upload failed:', uploadError)
      await supabase.from('sessions').delete().eq('id', sessionId)
      return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage
      .from('rohbericht-audio')
      .getPublicUrl(storagePath)

    await supabase.from('files').insert({
      session_id: sessionId,
      storage_path: storagePath,
      mime_type: storageMime,
      size_bytes: file.size,
      file_purpose: 'meeting',
      original_filename: `voicemail_${visitorName.replace(/\s+/g, '_')}.${ext}`,
      upload_status: 'completed',
    })

    await supabase
      .from('sessions')
      .update({
        audio_url: publicUrlData.publicUrl,
        status: 'uploading',
      })
      .eq('id', sessionId)

    // Trigger transcription via internal API
    const origin = new URL(request.url).origin
    try {
      const transcribeRes = await fetch(`${origin}/api/sessions/${sessionId}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!transcribeRes.ok) {
        console.warn('[Voicemail] Transcribe trigger returned non-OK:', transcribeRes.status)
      }
    } catch (triggerErr) {
      console.warn('[Voicemail] Failed to trigger transcription (will retry):', triggerErr)
    }

    console.log('[Voicemail] Voice message saved:', { sessionId, visitorName, visitorEmail, slug })

    return NextResponse.json({ success: true, sessionId })
  } catch (error: any) {
    console.error('[Voicemail] Error:', error)
    return NextResponse.json({ error: 'Failed to save voice message' }, { status: 500 })
  }
}

function inferExtension(mimeType: string): string {
  const mime = (mimeType || '').toLowerCase().split(';')[0].trim()
  const map: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/webm': 'webm',
  }
  return map[mime] || 'ogg'
}

function normalizeAudioMime(mimeType: string): string {
  const mime = (mimeType || '').toLowerCase().split(';')[0].trim()
  if (mime === 'audio/webm') return 'audio/ogg'
  if (mime.startsWith('audio/') || mime === 'application/ogg') return mime
  return 'audio/ogg'
}
