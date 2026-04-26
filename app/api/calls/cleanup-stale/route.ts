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

  // --- Phase 2: Clean up sessions stuck in created/uploading/recording ---
  //
  // 'created' is included because the UI surfaces it as "uploading" (see
  // mapStatus in lib/adapters/session-adapter.ts). When a client-side upload
  // dies before the session ever transitions to 'uploading' (e.g. a browser
  // tab is closed mid-TUS, or — as observed on old iPad Safari — the upload
  // path silently fails), the row otherwise stays "uploading" in the UI
  // forever. The guards below make sure we don't sweep legitimately-young
  // sessions: in-flight call sessions, callee-pending sessions, sessions with
  // a pending job, sessions with a recent file write, or sessions tied to a
  // currently active call.
  const sessionCutoff = new Date(Date.now() - STALE_SESSION_MINUTES * 60 * 1000).toISOString()

  const { data: stuckSessions, error: sessError } = await supabase
    .from('sessions')
    .select('id, status, created_at, pending_job_id, is_callee_pending')
    .in('status', ['created', 'uploading', 'recording'])
    .lt('created_at', sessionCutoff)

  if (sessError) {
    console.error('[Stale Cleanup] Session query error:', sessError.message)
  }

  let cleanedSessions = 0

  for (const session of stuckSessions || []) {
    try {
      // Skip caller-side sessions still waiting for the callee to upload.
      if ((session as any).is_callee_pending) {
        console.log(`[Stale Cleanup] Skipping session ${session.id} — is_callee_pending`)
        continue
      }

      // Skip sessions that have an active job — they're still processing.
      if (session.pending_job_id) {
        console.log(`[Stale Cleanup] Skipping session ${session.id} — has pending job ${session.pending_job_id}`)
        continue
      }

      // Skip sessions with a recent file upload (e.g. long calls where recording
      // is uploaded minutes after session creation).
      const recentFileCutoff = new Date(Date.now() - STALE_SESSION_MINUTES * 60 * 1000).toISOString()
      const { data: recentFiles } = await supabase
        .from('files')
        .select('id')
        .eq('session_id', session.id)
        .gte('created_at', recentFileCutoff)
        .limit(1)

      if (recentFiles && recentFiles.length > 0) {
        console.log(`[Stale Cleanup] Skipping session ${session.id} — has recent file upload`)
        continue
      }

      // Skip sessions with active async jobs (transcribe/analyze in progress).
      const { data: activeJobs } = await supabase
        .from('async_jobs')
        .select('id')
        .eq('payload->>sessionId', session.id)
        .in('status', ['queued', 'running', 'retryable'])
        .limit(1)

      if (activeJobs && activeJobs.length > 0) {
        console.log(`[Stale Cleanup] Skipping session ${session.id} — has active async job`)
        continue
      }

      // Skip sessions tied to a call that is still active. These can sit in
      // 'created' for a long time before recording starts (e.g. scheduled
      // meetings, room created but participants not joined yet).
      const liveCallStatuses = ['waiting', 'invited', 'active', 'connected', 'recording']
      const { data: linkedCalls } = await supabase
        .from('calls')
        .select('id')
        .or(`session_id.eq.${session.id},callee_session_id.eq.${session.id}`)
        .in('status', liveCallStatuses)
        .limit(1)

      if (linkedCalls && linkedCalls.length > 0) {
        console.log(`[Stale Cleanup] Skipping session ${session.id} — linked to active call`)
        continue
      }

      await supabase
        .from('sessions')
        .update({
          status: 'error',
          pending_job_id: null,
          last_error: `Stuck in '${session.status}' for over ${STALE_SESSION_MINUTES} minutes — cleaned up automatically`,
        })
        .eq('id', session.id)

      cleanedSessions++
      console.log(`[Stale Cleanup] Unstuck session ${session.id} (was: ${session.status}, created: ${session.created_at})`)
    } catch (err: any) {
      console.error(`[Stale Cleanup] Error cleaning session ${session.id}:`, err.message)
    }
  }

  // --- Phase 3: Reconcile sessions with orphaned pending_job_id ---
  // Sessions that have a pending_job_id but the job is completed/failed/missing.
  const { data: pendingSessions, error: pendingErr } = await supabase
    .from('sessions')
    .select('id, status, pending_job_id')
    .not('pending_job_id', 'is', null)

  if (pendingErr) {
    console.error('[Stale Cleanup] Pending job query error:', pendingErr.message)
  }

  let reconciledSessions = 0

  for (const session of pendingSessions || []) {
    try {
      const { data: job } = await supabase
        .from('async_jobs')
        .select('id, status, last_error')
        .eq('id', session.pending_job_id)
        .maybeSingle()

      if (!job) {
        // Job row is gone — clear the stale pointer
        await supabase
          .from('sessions')
          .update({ pending_job_id: null })
          .eq('id', session.id)
        reconciledSessions++
        console.log(`[Stale Cleanup] Cleared missing job ref on session ${session.id}`)
      } else if (job.status === 'completed') {
        await supabase
          .from('sessions')
          .update({ pending_job_id: null })
          .eq('id', session.id)
        reconciledSessions++
        console.log(`[Stale Cleanup] Cleared completed job ref on session ${session.id}`)
      } else if (job.status === 'failed') {
        await supabase
          .from('sessions')
          .update({
            pending_job_id: null,
            status: 'error',
            last_error: `Job failed: ${(job.last_error || 'unknown').slice(0, 500)}`,
          })
          .eq('id', session.id)
        reconciledSessions++
        console.log(`[Stale Cleanup] Marked session ${session.id} as error (job ${job.id} failed)`)
      }
    } catch (err: any) {
      console.error(`[Stale Cleanup] Error reconciling session ${session.id}:`, err.message)
    }
  }

  return NextResponse.json({
    cleanedCalls,
    cleanedSessions,
    reconciledSessions,
    checked: (staleCalls?.length || 0) + (stuckSessions?.length || 0) + (pendingSessions?.length || 0),
  })
}
