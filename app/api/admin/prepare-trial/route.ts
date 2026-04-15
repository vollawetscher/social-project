import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/prepare-trial
 *
 * One-click client trial setup:
 * 1. Create client account (or find existing)
 * 2. Transfer selected sessions to client & mark as curated
 * 3. Return a magic link the admin can share
 *
 * Body: { email: string, sessionIds: string[] }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const sessionIds = Array.isArray(body.sessionIds) ? body.sessionIds : []

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (sessionIds.length === 0) {
      return NextResponse.json({ error: 'At least one session is required' }, { status: 400 })
    }

    const adminSupabase = createServiceRoleClient()

    // 1. Create or find the client user via magic link generation
    //    generateLink with type 'magiclink' creates the user if they don't exist
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=/sessions`,
      },
    })

    if (linkError || !linkData?.user) {
      console.error('[PrepareTrial] Failed to generate magic link:', linkError)
      return NextResponse.json(
        { error: linkError?.message || 'Failed to create client account' },
        { status: 500 }
      )
    }

    const clientUserId = linkData.user.id
    const actionLink = linkData.properties?.action_link

    // Ensure the client has a profiles row (Supabase trigger may not fire for admin-created users)
    await adminSupabase
      .from('profiles')
      .upsert(
        { id: clientUserId, email, role: 'user' },
        { onConflict: 'id' }
      )

    // 2. Transfer sessions to client & mark as curated
    const { error: transferError } = await adminSupabase
      .from('sessions')
      .update({ user_id: clientUserId, curated: true })
      .in('id', sessionIds)

    if (transferError) {
      console.error('[PrepareTrial] Session transfer failed:', transferError)
      return NextResponse.json(
        { error: 'Failed to transfer sessions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      clientUserId,
      magicLink: actionLink,
      sessionsTransferred: sessionIds.length,
    })
  } catch (error: any) {
    if (error instanceof Error) {
      const authErr = handleAuthError(error)
      if (authErr.status !== 500) {
        return NextResponse.json({ error: authErr.message }, { status: authErr.status })
      }
    }
    console.error('[PrepareTrial] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
