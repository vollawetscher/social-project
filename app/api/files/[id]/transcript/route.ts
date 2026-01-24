import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

// GET /api/files/[id]/transcript - Get transcript for a specific file
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = createClient()

    // Get the file and verify ownership through session
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select(`
        id,
        file_purpose,
        created_at,
        sessions!inner (
          id,
          user_id,
          internal_case_id,
          context_note
        )
      `)
      .eq('id', params.id)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check ownership
    const session = (file as any).sessions
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get transcript for this file
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('*')
      .eq('file_id', params.id)
      .maybeSingle()

    if (transcriptError) {
      return NextResponse.json({ error: transcriptError.message }, { status: 500 })
    }

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    // Check if user is admin to determine raw vs redacted
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    return NextResponse.json({
      file: {
        id: file.id,
        purpose: file.file_purpose,
        created_at: file.created_at,
      },
      session: {
        id: session.id,
        internal_case_id: session.internal_case_id,
        context_note: session.context_note,
      },
      transcript: {
        id: transcript.id,
        segments: isAdmin ? transcript.raw_json : transcript.redacted_json,
        text: isAdmin ? transcript.raw_text : transcript.redacted_text,
        language: transcript.language,
        created_at: transcript.created_at,
      },
      is_admin: isAdmin,
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
