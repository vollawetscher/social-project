import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/calls/active
 * Returns the user's active call (if any) so the UI can show a rejoin banner.
 * A call is considered active if its status is one of the "live" statuses.
 */
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const activeStatuses = ['waiting', 'invited', 'active', 'connected', 'recording']

    // Exclude calls where the user is the callee — those are handled by
    // GlobalIncomingCallListener (incoming call dialog), not the Rejoin banner.
    const { data: call } = await supabase
      .from('calls')
      .select('id, room_name, call_type, call_mode, status, contact_name, phone_number, started_at, last_heartbeat_at, created_at, callee_user_id')
      .eq('user_id', user.id)
      .in('status', activeStatuses)
      .or(`callee_user_id.is.null,callee_user_id.neq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ active: false })
    }

    return NextResponse.json({
      active: true,
      call: {
        id: call.id,
        roomName: call.room_name,
        callType: call.call_type,
        callMode: call.call_mode,
        status: call.status,
        contactName: call.contact_name,
        phoneNumber: call.phone_number,
        startedAt: call.started_at,
        createdAt: call.created_at,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
