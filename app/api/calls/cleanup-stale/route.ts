import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { deleteRoom, listParticipants } from '@/lib/services/livekit'

const STALE_THRESHOLD_MINUTES = 5

/**
 * POST /api/calls/cleanup-stale
 * Finds calls with no heartbeat for >5 minutes and:
 * - If the LiveKit room is empty → delete room, mark call ended
 * - If the room still has participants → leave it alone (SIP/agent still active)
 * Protected by INTERNAL_API_SECRET or CRON_SECRET.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-internal-secret') || request.headers.get('x-cron-secret')
  const validSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET
  if (!secret || secret !== validSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString()

  const activeStatuses = ['waiting', 'invited', 'active', 'connected', 'recording']

  const { data: staleCalls, error } = await supabase
    .from('calls')
    .select('id, room_name, status, last_heartbeat_at, started_at, created_at')
    .in('status', activeStatuses)
    .or(`last_heartbeat_at.lt.${cutoff},last_heartbeat_at.is.null`)
    .lt('created_at', cutoff)

  if (error) {
    console.error('[Stale Cleanup] Query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!staleCalls?.length) {
    return NextResponse.json({ cleaned: 0 })
  }

  let cleaned = 0

  for (const call of staleCalls) {
    try {
      let roomEmpty = true
      try {
        const participants = await listParticipants(call.room_name)
        roomEmpty = !participants || participants.length === 0
      } catch {
        roomEmpty = true
      }

      if (!roomEmpty) {
        console.log(`[Stale Cleanup] Room ${call.room_name} still has participants, skipping`)
        continue
      }

      try {
        await deleteRoom(call.room_name)
        console.log(`[Stale Cleanup] Deleted empty room: ${call.room_name}`)
      } catch {
        // Room may already be gone
      }

      await supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          last_error: 'Ended by stale call cleanup (no heartbeat)',
        })
        .eq('id', call.id)

      cleaned++
      console.log(`[Stale Cleanup] Cleaned stale call ${call.id} (room: ${call.room_name})`)
    } catch (err: any) {
      console.error(`[Stale Cleanup] Error cleaning call ${call.id}:`, err.message)
    }
  }

  return NextResponse.json({ cleaned, checked: staleCalls.length })
}
