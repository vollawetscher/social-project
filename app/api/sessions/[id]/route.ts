import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)

    // requireSessionAccess already verified access. Use service role so admins
    // can read sessions belonging to other users regardless of RLS policy state.
    const db = createServiceRoleClient()

    const { data: session, error } = await db
      .from('sessions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Also fetch files for this session
    const { data: files } = await db
      .from('files')
      .select('*')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    // Generate signed URLs for audio files (1-hour expiry) so the client can play them
    let filesWithUrls: any[] = files || []
    if (filesWithUrls.length > 0) {
      const paths = filesWithUrls.map((f: any) => f.storage_path).filter(Boolean)
      if (paths.length > 0) {
        const { data: signedUrls } = await db.storage
          .from('rohbericht-audio')
          .createSignedUrls(paths, 3600)

        if (signedUrls) {
          filesWithUrls = filesWithUrls.map((f: any) => {
            const match = signedUrls.find((s) => s.path === f.storage_path)
            return { ...f, signed_url: match?.signedUrl ?? null }
          })
        }
      }
    }

    // Fetch in-call consent logs if this session is linked to a call
    let consentLogs: any[] = []
    const { data: linkedCall } = await db
      .from('calls')
      .select('id')
      .or(`session_id.eq.${params.id},callee_session_id.eq.${params.id}`)
      .maybeSingle()

    if (linkedCall?.id) {
      const { data: consents } = await db
        .from('consent_logs')
        .select('participant_name, participant_identity, granted, created_at')
        .eq('call_id', linkedCall.id)
        .order('created_at', { ascending: true })
      consentLogs = consents || []
    }

    return NextResponse.json({
      ...session,
      files: filesWithUrls,
      consent_logs: consentLogs,
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)
    const supabase = await createClient()
    const body = await request.json()

    const { data: session, error } = await supabase
      .from('sessions')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)

    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    // Use service role when admin deletes another user's session (bypasses RLS)
    const db = isAdmin ? createServiceRoleClient() : supabase

    const { data: files } = await db
      .from('files')
      .select('storage_path')
      .eq('session_id', params.id)

    if (files && files.length > 0) {
      const paths = files.map((f) => f.storage_path)
      await db.storage.from('rohbericht-audio').remove(paths)
    }

    const { data: deleted, error } = await db
      .from('sessions')
      .delete()
      .eq('id', params.id)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Session not found or could not be deleted' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
