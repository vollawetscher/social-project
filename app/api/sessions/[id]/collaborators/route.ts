import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireAuth, requireSessionOwnership, handleAuthError } from '@/lib/auth/helpers'

/**
 * GET /api/sessions/[id]/collaborators
 * List the users this session is shared with. Owner or admin only.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    // Allow owner OR admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      await requireSessionOwnership(params.id, user.id)
    }

    const db = isAdmin ? createServiceRoleClient() : supabase

    const { data: rows, error } = await db
      .from('session_collaborators')
      .select('user_id, role, added_at, added_by, source')
      .eq('session_id', params.id)
      .order('added_at', { ascending: false })

    if (error) {
      console.error('[Collaborators] List error:', error)
      return NextResponse.json({ error: 'Failed to load collaborators' }, { status: 500 })
    }

    const userIds = Array.from(new Set((rows || []).map((r: any) => r.user_id).filter(Boolean)))
    let profiles: Record<string, { email?: string; display_name?: string }> = {}
    if (userIds.length > 0) {
      const svc = createServiceRoleClient()
      const { data: profileRows } = await svc
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds)
      profiles = (profileRows || []).reduce((acc: Record<string, any>, p: any) => {
        acc[p.id] = { email: p.email, display_name: p.display_name }
        return acc
      }, {})
    }

    const collaborators = (rows || []).map((r: any) => ({
      userId: r.user_id,
      email: profiles[r.user_id]?.email || null,
      displayName: profiles[r.user_id]?.display_name || null,
      role: r.role,
      addedAt: r.added_at,
      addedBy: r.added_by,
      source: r.source || null,
    }))

    return NextResponse.json({ collaborators })
  } catch (error) {
    if (error instanceof Error) {
      const authErr = handleAuthError(error)
      return NextResponse.json({ error: authErr.message }, { status: authErr.status })
    }
    console.error('[Collaborators] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/sessions/[id]/collaborators
 * Share the session with a user by email. Owner only.
 * Body: { email: string }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionOwnership(params.id, user.id)

    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const svc = createServiceRoleClient()

    const { data: targetProfile } = await svc
      .from('profiles')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle()

    if (!targetProfile?.id) {
      return NextResponse.json(
        { error: 'No account found for that email. Ask them to sign up first.' },
        { status: 404 }
      )
    }

    if (targetProfile.id === user.id) {
      return NextResponse.json(
        { error: 'You already own this session' },
        { status: 400 }
      )
    }

    const { error: insertError } = await svc
      .from('session_collaborators')
      .upsert(
        {
          session_id: params.id,
          user_id: targetProfile.id,
          role: 'collaborator',
          added_by: user.id,
        },
        { onConflict: 'session_id,user_id', ignoreDuplicates: false }
      )

    if (insertError) {
      console.error('[Collaborators] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to share session' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      collaborator: {
        userId: targetProfile.id,
        email: targetProfile.email,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      const authErr = handleAuthError(error)
      return NextResponse.json({ error: authErr.message }, { status: authErr.status })
    }
    console.error('[Collaborators] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/sessions/[id]/collaborators?userId=...
 * Revoke access for a collaborator. Owner only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionOwnership(params.id, user.id)

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const svc = createServiceRoleClient()
    const { error } = await svc
      .from('session_collaborators')
      .delete()
      .eq('session_id', params.id)
      .eq('user_id', targetUserId)

    if (error) {
      console.error('[Collaborators] Delete error:', error)
      return NextResponse.json({ error: 'Failed to revoke access' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      const authErr = handleAuthError(error)
      return NextResponse.json({ error: authErr.message }, { status: authErr.status })
    }
    console.error('[Collaborators] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
