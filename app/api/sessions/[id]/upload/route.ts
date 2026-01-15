import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const duration = parseInt(formData.get('duration') as string || '0', 10)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    await supabase
      .from('sessions')
      .update({ status: 'uploading' })
      .eq('id', params.id)

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const storagePath = `${user.id}/${params.id}/${fileName}`

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
