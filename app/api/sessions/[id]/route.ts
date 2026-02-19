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

    return NextResponse.json({
      ...session,
      files: files || []
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
