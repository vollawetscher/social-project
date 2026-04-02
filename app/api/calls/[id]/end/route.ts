import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { deleteRoom } from '@/lib/services/livekit'

/**
 * POST /api/calls/[id]/end
 * Forcefully ends a call by deleting the LiveKit room.
 * Also updates call status to 'ended' immediately (don't rely solely on webhook).
 * Session cleanup for short/unanswered calls prevents stuck 'uploading' states.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: call } = await supabase
      .from('calls')
      .select('id, room_name, status, session_id, started_at, track_a_egress_id, track_b_egress_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Delete the LiveKit room — this terminates all participants including SIP legs
    try {
      await deleteRoom(call.room_name)
      console.log('[Calls End] Room deleted:', call.room_name)
    } catch (err: any) {
      console.warn('[Calls End] deleteRoom warning:', err.message)
    }

    // Update call status immediately — don't rely solely on room_finished webhook
    const terminalStatuses = ['ended', 'missed', 'declined', 'error']
    if (!terminalStatuses.includes(call.status)) {
      await supabase
        .from('calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', call.id)
      console.log('[Calls End] Call status set to ended:', call.id)
    }

    // Clean up session for calls that never produced a recording
    const hasEgress = !!(call.track_a_egress_id || call.track_b_egress_id)
    if (call.session_id && !hasEgress) {
      const { data: session } = await supabase
        .from('sessions')
        .select('status')
        .eq('id', call.session_id)
        .maybeSingle()

      if (session?.status === 'created' || session?.status === 'recording') {
        await supabase
          .from('calls')
          .update({ session_id: null })
          .eq('id', call.id)
        await supabase
          .from('sessions')
          .delete()
          .eq('id', call.session_id)
        console.log('[Calls End] Deleted empty session (no egress):', call.session_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
