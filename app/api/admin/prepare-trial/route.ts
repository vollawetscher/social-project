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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Check if this email already belongs to an existing user
    const { data: existingProfile } = await adminSupabase
      .from('profiles')
      .select('id, role, email')
      .ilike('email', email)
      .maybeSingle()

    const isExistingUser = Boolean(existingProfile)

    if (existingProfile?.id === user.id) {
      return NextResponse.json(
        { error: 'Cannot prepare a trial for yourself' },
        { status: 400 }
      )
    }

    let clientUserId: string

    // Generate magic link — works for both new and existing users
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError || !linkData?.user) {
      console.error('[PrepareTrial] Failed to generate magic link:', linkError)
      return NextResponse.json(
        { error: linkError?.message || 'Failed to create client account' },
        { status: 500 }
      )
    }

    clientUserId = linkData.user.id
    const hashedToken = linkData.properties?.hashed_token

    if (!hashedToken) {
      console.error('[PrepareTrial] No hashed_token in generateLink response')
      return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 })
    }

    // Build a verify URL that works client-side (bypasses PKCE code-verifier issue)
    const magicLink = `${siteUrl}/auth/verify?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=/sessions`

    // Only create a profile row for brand-new users (don't overwrite existing roles)
    if (!existingProfile) {
      await adminSupabase
        .from('profiles')
        .upsert(
          { id: clientUserId, email, role: 'user' },
          { onConflict: 'id', ignoreDuplicates: true }
        )
    }

    // Only share sessions the admin actually owns.
    const { data: ownedSessions } = await adminSupabase
      .from('sessions')
      .select('id')
      .in('id', sessionIds)
      .eq('user_id', user.id)

    const ownedIds = (ownedSessions || []).map((s: { id: string }) => s.id)
    if (ownedIds.length === 0) {
      return NextResponse.json(
        { error: 'None of the selected sessions belong to you' },
        { status: 400 }
      )
    }

    if (clientUserId === user.id) {
      return NextResponse.json(
        { error: 'Cannot share a session with yourself' },
        { status: 400 }
      )
    }

    // Mark sessions as curated (hides destructive controls in the trial view)
    const { error: curateError } = await adminSupabase
      .from('sessions')
      .update({ curated: true })
      .in('id', ownedIds)

    if (curateError) {
      console.error('[PrepareTrial] Failed to mark sessions as curated:', curateError)
      // Non-fatal — proceed with share insert
    }

    // Share sessions with the client as collaborators. Ownership is retained
    // by the admin so they keep full access and can support the client.
    const shareRows = ownedIds.map((sessionId) => ({
      session_id: sessionId,
      user_id: clientUserId,
      role: 'collaborator',
      added_by: user.id,
      source: 'trial',
    }))

    const { error: shareError } = await adminSupabase
      .from('session_collaborators')
      .upsert(shareRows, { onConflict: 'session_id,user_id', ignoreDuplicates: false })

    if (shareError) {
      console.error('[PrepareTrial] Failed to create collaborator rows:', shareError)
      return NextResponse.json(
        { error: 'Failed to share sessions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      clientUserId,
      magicLink,
      sessionsShared: ownedIds.length,
      sessionsSkipped: sessionIds.length - ownedIds.length,
      isExistingUser,
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
