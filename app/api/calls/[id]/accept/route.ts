import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createServiceRoleClient, createClient } from '@/lib/supabase/server'
import { createRoomToken } from '@/lib/services/livekit'

/**
 * POST /api/calls/[id]/accept
 * Accept an in-app invite and return a join token.
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
      .select('id, room_name, call_mode, user_id, callee_user_id, status, accepted_at')
      .eq('id', params.id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (call.user_id === user.id) {
      return NextResponse.json({ error: 'Caller cannot accept own invite' }, { status: 400 })
    }

    if (call.callee_user_id && call.callee_user_id !== user.id) {
      return NextResponse.json({ error: 'Call is assigned to a different callee' }, { status: 409 })
    }

    if (['declined', 'missed', 'ended', 'error'].includes(call.status)) {
      return NextResponse.json({ error: 'Call is no longer joinable' }, { status: 409 })
    }

    if (!call.accepted_at) {
      const { data: acceptedCall, error: updateError } = await db
        .from('calls')
        .update({
          status: 'active',
          accepted_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          callee_user_id: user.id,
          callee_declined: false,
          declined_at: null,
          missed_at: null,
        })
        .eq('id', call.id)
        .is('accepted_at', null)
        .select('id, callee_user_id')
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ error: 'Failed to accept call' }, { status: 500 })
      }
      if (!acceptedCall || acceptedCall.callee_user_id !== user.id) {
        return NextResponse.json({ error: 'Call was accepted by another participant' }, { status: 409 })
      }
    }

    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle()
    const displayName = profile?.display_name || profile?.email || 'User'

    const token = await createRoomToken(call.room_name, user.id, displayName)
    return NextResponse.json({
      callId: call.id,
      roomName: call.room_name,
      mode: call.call_mode || 'video',
      token,
      displayName,
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
