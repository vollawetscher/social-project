/**
 * Internal API: Always trigger session_analyze after transcription completes.
 * Requires x-internal-secret header.
 */
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/services/error-logger'
import { enqueueAsyncJob, triggerAsyncWorker, linkJobToSession } from '@/lib/services/queue'

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

    const job = await enqueueAsyncJob({
      userId,
      jobType: 'session_analyze',
      payload: { sessionId },
      idempotencyKey: `session_analyze:${sessionId}`,
      maxAttempts: 5,
    })
    await linkJobToSession(job.id, sessionId)
    triggerAsyncWorker()

    console.log('[Post-Transcribe] Analyze queued for session:', sessionId, 'job:', job.id)
    return NextResponse.json({ ok: true, queued: true, jobId: job.id }, { status: 202 })
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
