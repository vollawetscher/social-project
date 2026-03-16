import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/calls/[id]/miss
 * Mark an unanswered invite as missed (timeout path).
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
      .select('id, user_id, callee_user_id, status, accepted_at, missed_at')
      .eq('id', params.id)
      .maybeSingle()

    if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

    const isParticipant = call.user_id === user.id || call.callee_user_id === user.id
    if (!isParticipant) return NextResponse.json({ error: 'Not authorized for this call' }, { status: 403 })

    if (call.missed_at || call.status === 'missed') return NextResponse.json({ ok: true })
    if (call.accepted_at || call.status === 'active') {
      return NextResponse.json({ error: 'Call already accepted' }, { status: 409 })
    }
    if (!['invited', 'waiting'].includes(call.status)) {
      return NextResponse.json({ error: 'Call cannot be marked as missed' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { error } = await db
      .from('calls')
      .update({
        status: 'missed',
        missed_at: now,
        ended_at: now,
      })
      .eq('id', call.id)
      .is('accepted_at', null)

    if (error) return NextResponse.json({ error: 'Failed to mark call missed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
