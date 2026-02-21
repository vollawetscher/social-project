import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { stopEgress, startTrackEgressForParticipant, listEgress } from '@/lib/services/livekit'

/**
 * POST /api/calls/[id]/switch-egress
 *
 * Switch from Room Composite Egress (all participants) to Track Egress
 * (caller only). Called when the callee declines transcription consent
 * but stays in the call.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const callId = params.id
    const db = createServiceRoleClient()

    const { data: call, error } = await db
      .from('calls')
      .select('id, room_name, session_id, participant_a_identity, track_a_egress_id')
      .eq('id', callId)
      .maybeSingle()

    if (error || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (!call.room_name || !call.session_id || !call.participant_a_identity) {
      return NextResponse.json({ error: 'Call missing required data' }, { status: 400 })
    }

    // Stop the current Room Composite Egress
    if (call.track_a_egress_id) {
      try {
        await stopEgress(call.track_a_egress_id)
        console.log('[SwitchEgress] Stopped Room Composite egress:', call.track_a_egress_id)
      } catch (err: any) {
        // May already be stopped — not fatal
        console.warn('[SwitchEgress] Could not stop old egress:', err.message)
      }
    }

    // Start Track Egress for caller only
    const egress = await startTrackEgressForParticipant(
      call.room_name,
      call.session_id,
      call.participant_a_identity,
    )

    // Update call record with new egress ID (old egress_ended events will be
    // ignored because track_a_egress_id no longer matches)
    await db
      .from('calls')
      .update({ track_a_egress_id: egress.egressId })
      .eq('id', call.id)

    console.log('[SwitchEgress] Switched to caller-only Track Egress:', egress.egressId)

    return NextResponse.json({ success: true, egressId: egress.egressId })
  } catch (error: any) {
    console.error('[SwitchEgress] Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to switch egress' }, { status: 500 })
  }
}
