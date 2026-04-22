import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)
    const supabase = await createClient()

    const body = await request.json().catch(() => ({}))
    const newOwnerEmail = typeof body.newOwnerEmail === 'string' ? body.newOwnerEmail.trim() : ''
    if (!newOwnerEmail) {
      return NextResponse.json(
        { error: 'newOwnerEmail is required' },
        { status: 400 }
      )
    }

    // Verify requester is current session owner
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, user_id')
      .eq('id', params.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the session owner can reassign it' },
        { status: 403 }
      )
    }

    // Look up target user by email (case-insensitive)
    // Use service role - RLS restricts profiles to own row; owner needs to find other users
    const adminSupabase = createServiceRoleClient()
    const { data: targetProfile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id')
      .ilike('email', newOwnerEmail)
      .maybeSingle()

    if (profileError || !targetProfile) {
      return NextResponse.json(
        { error: 'No user found with that email' },
        { status: 404 }
      )
    }
    if (targetProfile.id === user.id) {
      return NextResponse.json(
        { error: 'Cannot reassign to yourself' },
        { status: 400 }
      )
    }

    // Use service role to bypass RLS (user_id change is blocked by WITH CHECK)
    const { data: updated, error: updateError } = await adminSupabase
      .from('sessions')
      .update({ user_id: targetProfile.id })
      .eq('id', params.id)
      .select('id, user_id')
      .single()

    if (updateError) {
      console.error('[Reassign] Update failed:', updateError)
      return NextResponse.json(
        { error: 'Failed to reassign session' },
        { status: 500 }
      )
    }

    // Transfer ownership of session-scoped artifacts to the new owner so the
    // hand-off is clean. Without this, rows like `outputs` stay attached to
    // the previous owner and the new owner — despite being the session owner —
    // cannot delete / share / update them because those endpoints gate on
    // `created_by = auth.uid()`. Audit tables (`pipeline_events`,
    // `error_logs`) intentionally keep their historical `user_id`.
    const warnings: string[] = []

    const { error: outputsError } = await adminSupabase
      .from('outputs')
      .update({ created_by: targetProfile.id })
      .eq('session_id', params.id)

    if (outputsError) {
      console.error('[Reassign] Failed to transfer outputs ownership:', outputsError)
      warnings.push('Some outputs could not be reassigned')
    }

    const { error: callsError } = await adminSupabase
      .from('calls')
      .update({ user_id: targetProfile.id })
      .eq('session_id', params.id)

    if (callsError) {
      console.error('[Reassign] Failed to transfer calls ownership:', callsError)
      warnings.push('Some calls could not be reassigned')
    }

    // If the new owner was previously a collaborator on this session, that
    // row is now redundant (owner > collaborator). Remove it to avoid a
    // stale "shared with me" entry for them.
    const { error: collabError } = await adminSupabase
      .from('session_collaborators')
      .delete()
      .eq('session_id', params.id)
      .eq('user_id', targetProfile.id)

    if (collabError) {
      console.error('[Reassign] Failed to clean up collaborator row:', collabError)
    }

    return NextResponse.json({
      success: true,
      session: updated,
      ...(warnings.length > 0 ? { warnings } : {}),
    })
  } catch (error: any) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status !== 500) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }
    console.error('[Reassign] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reassign session' },
      { status: 500 }
    )
  }
}
