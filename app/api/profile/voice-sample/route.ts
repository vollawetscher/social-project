import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: samples, error } = await supabase
      .from('voice_samples')
      .select('id, language, storage_path, duration_ms, created_at')
      .eq('user_id', user.id)
      .order('language', { ascending: true })

    if (error) throw error
    return NextResponse.json({ samples: samples || [] })
  } catch (error: any) {
    console.error('[VoiceSample] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const language = String(formData.get('language') || '').trim().toLowerCase()

    if (!language || !/^[a-z]{2}$/.test(language)) {
      return NextResponse.json({ error: 'Valid 2-letter language code is required' }, { status: 400 })
    }
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

    const { data: existing } = await db
      .from('voice_samples')
      .select('id, storage_path')
      .eq('user_id', user.id)
      .eq('language', language)
      .maybeSingle()

    if (existing?.storage_path) {
      await db.storage.from('rohbericht-audio').remove([existing.storage_path])
    }

    const rawMime = audioFile.type || 'audio/ogg'
    const contentType = rawMime.split(';')[0].trim()
    const ext = contentType.includes('ogg') ? 'ogg' : contentType.includes('webm') ? 'webm' : 'ogg'
    const storagePath = `voice-samples/${user.id}/${language}_${Date.now()}.${ext}`
    const buffer = Buffer.from(await audioFile.arrayBuffer())

    const { error: uploadError } = await db.storage
      .from('rohbericht-audio')
      .upload(storagePath, buffer, { contentType, upsert: false })

    if (uploadError) {
      console.error('[VoiceSample] Upload failed:', uploadError)
      return NextResponse.json({ error: 'Failed to upload voice sample' }, { status: 500 })
    }

    const upsertData = {
      user_id: user.id,
      language,
      storage_path: storagePath,
      duration_ms: Math.round(durationMs),
    }

    let result
    if (existing) {
      const { data, error } = await db
        .from('voice_samples')
        .update({ storage_path: storagePath, duration_ms: Math.round(durationMs) })
        .eq('id', existing.id)
        .select()
        .single()
      result = { data, error }
    } else {
      const { data, error } = await db
        .from('voice_samples')
        .insert(upsertData)
        .select()
        .single()
      result = { data, error }
    }

    if (result.error) {
      console.error('[VoiceSample] DB error:', result.error)
      await db.storage.from('rohbericht-audio').remove([storagePath])
      return NextResponse.json({ error: 'Failed to save voice sample' }, { status: 500 })
    }

    return NextResponse.json({ sample: result.data })
  } catch (error: any) {
    console.error('[VoiceSample] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { language } = await request.json().catch(() => ({ language: '' }))
    if (!language || !/^[a-z]{2}$/.test(language)) {
      return NextResponse.json({ error: 'Valid language code is required' }, { status: 400 })
    }

    const db = createServiceRoleClient()

    const { data: sample } = await db
      .from('voice_samples')
      .select('id, storage_path')
      .eq('user_id', user.id)
      .eq('language', language)
      .maybeSingle()

    if (sample?.storage_path) {
      await db.storage.from('rohbericht-audio').remove([sample.storage_path])
    }
    if (sample) {
      await db.from('voice_samples').delete().eq('id', sample.id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[VoiceSample] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
