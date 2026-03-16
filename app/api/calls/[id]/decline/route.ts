import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/calls/[id]/decline
 * Decline an in-app invite.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request)
    const db = createServiceRoleClient()

    const { data: call } = await db
      .from('calls')
      .select('id, user_id, callee_user_id, status, accepted_at')
      .eq('id', params.id)
      .maybeSingle()

    if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    if (call.user_id === user.id) {
      return NextResponse.json({ error: 'Caller cannot decline own invite' }, { status: 400 })
    }
    if (call.callee_user_id && call.callee_user_id !== user.id) {
      return NextResponse.json({ error: 'Call is assigned to a different callee' }, { status: 409 })
    }
    if (call.accepted_at || call.status === 'active') {
      return NextResponse.json({ error: 'Call already accepted' }, { status: 409 })
    }
    if (call.status === 'declined') return NextResponse.json({ ok: true })

    const now = new Date().toISOString()
    const { error } = await db
      .from('calls')
      .update({
        status: 'declined',
        callee_declined: true,
        declined_at: now,
        ended_at: now,
        callee_user_id: call.callee_user_id || user.id,
      })
      .eq('id', call.id)

    if (error) return NextResponse.json({ error: 'Failed to decline call' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
