import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const durationMs = Number(formData.get('durationMs') || 0)

    if (!audioFile || audioFile.size < 1024) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }
    if (audioFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio file too large (max 5MB)' }, { status: 400 })
    }
    if (durationMs < 2000 || durationMs > 30000) {
      return NextResponse.json({ error: 'Recording must be between 2 and 30 seconds' }, { status: 400 })
    }

    const db = createServiceRoleClient()

    const { data: existingProfile } = await db
      .from('profiles')
      .select('voice_sample_path')
      .eq('id', user.id)
      .single()

    if (existingProfile?.voice_sample_path) {
      await db.storage.from('rohbericht-audio').remove([existingProfile.voice_sample_path])
    }

    const rawMime = audioFile.type || 'audio/ogg'
    const contentType = rawMime.split(';')[0].trim()
    const ext = contentType.includes('ogg') ? 'ogg' : contentType.includes('webm') ? 'webm' : 'ogg'
    const storagePath = `voice-samples/${user.id}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await audioFile.arrayBuffer())

    const { error: uploadError } = await db.storage
      .from('rohbericht-audio')
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      console.error('[VoiceSample] Upload failed:', uploadError)
      return NextResponse.json({ error: 'Failed to upload voice sample' }, { status: 500 })
    }

    const { data: profile, error: updateError } = await db
      .from('profiles')
      .update({
        voice_sample_path: storagePath,
        voice_sample_duration_ms: Math.round(durationMs),
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[VoiceSample] Profile update failed:', updateError)
      await db.storage.from('rohbericht-audio').remove([storagePath])
      return NextResponse.json({ error: 'Failed to save voice sample' }, { status: 500 })
    }

    return NextResponse.json({
      voice_sample_path: profile.voice_sample_path,
      voice_sample_duration_ms: profile.voice_sample_duration_ms,
    })
  } catch (error: any) {
    console.error('[VoiceSample] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceRoleClient()

    const { data: profile } = await db
      .from('profiles')
      .select('voice_sample_path')
      .eq('id', user.id)
      .single()

    if (profile?.voice_sample_path) {
      await db.storage.from('rohbericht-audio').remove([profile.voice_sample_path])
    }

    await db
      .from('profiles')
      .update({ voice_sample_path: null, voice_sample_duration_ms: null })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[VoiceSample] Delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
