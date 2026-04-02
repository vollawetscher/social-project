import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { startCompositeEgress } from '@/lib/services/livekit'

/**
 * POST /api/calls/[id]/heartbeat
 * Lightweight keepalive — updates last_heartbeat_at only.
 * 
 * Also acts as a self-healing fallback: if the client reports a remote
 * participant but the server has no egress running, starts composite
 * egress. This covers cases where the LiveKit participant_joined
 * webhook was never delivered.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const clientHasRemote = body?.hasRemote === true

    const { data: call } = await supabase
      .from('calls')
      .select('id, status, session_id, room_name, participant_b_identity, track_a_egress_id, track_b_egress_id, call_type')
      .eq('id', params.id)
      .or(`user_id.eq.${user.id},callee_user_id.eq.${user.id}`)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { last_heartbeat_at: now }

    // If client sees a remote participant but call is still 'waiting', 
    // the webhook missed the activation. Set to active + started_at.
    if (clientHasRemote && (call.status === 'waiting' || call.status === 'invited')) {
      updates.status = 'active'
      updates.started_at = now
      console.log('[Heartbeat] Fallback activation — client has remote but call was', call.status, ':', call.id)
    }

    await supabase.from('calls').update(updates).eq('id', params.id)

    // Self-healing: start egress if client has remote but no recording exists
    const hasEgress = !!(call.track_a_egress_id || call.track_b_egress_id)
    let egressStarted = false

    if (clientHasRemote && !hasEgress && call.session_id && call.room_name && call.call_type !== 'pstn_outbound') {
      try {
        const db = createServiceRoleClient()
        const egress = await startCompositeEgress(call.room_name, call.session_id)
        await db
          .from('calls')
          .update({ track_a_egress_id: egress.egressId })
          .eq('id', call.id)
        await db
          .from('sessions')
          .update({ status: 'recording' })
          .eq('id', call.session_id)
        egressStarted = true
        console.log('[Heartbeat] Fallback egress started for call', call.id, 'egress:', egress.egressId)
      } catch (err: any) {
        console.error('[Heartbeat] Fallback egress failed:', call.id, err?.message)
      }
    }

    return NextResponse.json({
      ok: true,
      callStatus: updates.status || call.status,
      hasEgress: hasEgress || egressStarted,
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
