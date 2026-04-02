import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { deleteRoom, listParticipants } from '@/lib/services/livekit'

const STALE_CALL_MINUTES = 5
const STALE_SESSION_MINUTES = 10

/**
 * POST /api/calls/cleanup-stale
 * 1. Finds calls with no heartbeat for >5 min → delete room, mark ended
 * 2. Finds sessions stuck in 'uploading' or 'recording' for >10 min → mark error
 * Protected by INTERNAL_API_SECRET or CRON_SECRET.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-internal-secret') || request.headers.get('x-cron-secret')
  const validSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET
  if (!secret || secret !== validSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // --- Phase 1: Clean up stale calls ---
  const callCutoff = new Date(Date.now() - STALE_CALL_MINUTES * 60 * 1000).toISOString()
  const activeStatuses = ['waiting', 'invited', 'active', 'connected', 'recording']

  const { data: staleCalls, error } = await supabase
    .from('calls')
    .select('id, room_name, status, session_id, last_heartbeat_at, started_at, created_at')
    .in('status', activeStatuses)
    .or(`last_heartbeat_at.lt.${callCutoff},last_heartbeat_at.is.null`)
    .lt('created_at', callCutoff)

  if (error) {
    console.error('[Stale Cleanup] Query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let cleanedCalls = 0

  for (const call of staleCalls || []) {
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

      cleanedCalls++
      console.log(`[Stale Cleanup] Cleaned stale call ${call.id} (room: ${call.room_name})`)
    } catch (err: any) {
      console.error(`[Stale Cleanup] Error cleaning call ${call.id}:`, err.message)
    }
  }

  // --- Phase 2: Clean up sessions stuck in uploading/recording ---
  const sessionCutoff = new Date(Date.now() - STALE_SESSION_MINUTES * 60 * 1000).toISOString()

  const { data: stuckSessions, error: sessError } = await supabase
    .from('sessions')
    .select('id, status, created_at')
    .in('status', ['uploading', 'recording'])
    .lt('created_at', sessionCutoff)

  if (sessError) {
    console.error('[Stale Cleanup] Session query error:', sessError.message)
  }

  let cleanedSessions = 0

  for (const session of stuckSessions || []) {
    try {
      await supabase
        .from('sessions')
        .update({
          status: 'error',
          last_error: `Stuck in '${session.status}' for over ${STALE_SESSION_MINUTES} minutes — cleaned up automatically`,
        })
        .eq('id', session.id)

      cleanedSessions++
      console.log(`[Stale Cleanup] Unstuck session ${session.id} (was: ${session.status}, created: ${session.created_at})`)
    } catch (err: any) {
      console.error(`[Stale Cleanup] Error cleaning session ${session.id}:`, err.message)
    }
  }

  return NextResponse.json({
    cleanedCalls,
    cleanedSessions,
    checked: (staleCalls?.length || 0) + (stuckSessions?.length || 0),
  })
}
