/**
 * Internal API: After transcription, either park at the speaker/role gate
 * or enqueue session_analyze once the owner role is known.
 * Requires x-internal-secret header.
 */
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/services/error-logger'
import { enqueueAsyncJob, triggerAsyncWorker, linkJobToSession } from '@/lib/services/queue'
import { enqueueSessionAnalyzeWhenRoleReady } from '@/lib/services/session-analyze-gate'
import { transcriptNeedsSpeakerReview } from '@/lib/utils/speaker-resolution'

export async function POST(request: Request) {
  try {
    // If INTERNAL_API_SECRET is configured, enforce it. If not set, allow (internal calls only).
    const expectedSecret = process.env.INTERNAL_API_SECRET
    const providedSecret = request.headers.get('x-internal-secret')
    if (expectedSecret && providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { sessionId } = body
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Get session and user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('[Post-Transcribe] Session not found:', sessionId)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const userId = session.user_id
    if (!userId) {
      return NextResponse.json({ error: 'Session has no user' }, { status: 400 })
    }

    // Speaker-review gate: if the transcript still carries acoustic labels
    // (S1, S2, …) for ≥2 speakers, the speaker identity was guessed and must be
    // reconciled + confirmed before the expensive analysis runs. Known/explicit
    // speakers (imports, pasted chats, named call participants) and single-speaker
    // dictations carry no acoustic labels and proceed straight to analysis.
    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('raw_json')
      .eq('session_id', sessionId)
    const segments = (transcripts || []).flatMap((t: any) =>
      Array.isArray(t?.raw_json) ? t.raw_json : []
    )

    if (transcriptNeedsSpeakerReview(segments)) {
      await supabase
        .from('sessions')
        .update({ status: 'awaiting_speaker_review' })
        .eq('id', sessionId)

      const job = await enqueueAsyncJob({
        userId,
        jobType: 'session_reconcile',
        payload: { sessionId },
        idempotencyKey: `session_reconcile:${sessionId}`,
        maxAttempts: 3,
      })
      await linkJobToSession(job.id, sessionId)
      triggerAsyncWorker()

      console.log('[Post-Transcribe] Speaker review gate: reconcile queued for session:', sessionId, 'job:', job.id)
      return NextResponse.json({ ok: true, queued: true, gated: true, jobId: job.id }, { status: 202 })
    }

    const analyze = await enqueueSessionAnalyzeWhenRoleReady({
      supabase,
      sessionId,
      userId,
      segments,
    })
    if (analyze.gated) {
      console.log('[Post-Transcribe] Holding analyze until owner role is set:', sessionId)
      return NextResponse.json({ ok: true, queued: false, gated: true, reason: 'owner_role_required' }, { status: 202 })
    }

    console.log('[Post-Transcribe] Analyze queued for session:', sessionId, 'job:', analyze.jobId)
    return NextResponse.json({ ok: true, queued: analyze.queued, jobId: analyze.jobId }, { status: 202 })
  } catch (error: any) {
    console.error('[Post-Transcribe] Error:', error)
    await logError({
      errorType: 'server_error',
      severity: 'error',
      message: `Post-transcribe unhandled error: ${error?.message || 'Unknown'}`,
      error,
      endpoint: '/api/internal/post-transcribe',
      method: 'POST',
      metadata: { step: 'unhandled_exception' },
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}
