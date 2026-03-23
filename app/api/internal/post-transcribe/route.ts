/**
 * Internal API: Trigger analyze + auto-generate after transcription completes.
 * Called by the transcribe background job when user has after_transcript_template_id set.
 * Requires x-internal-secret header.
 */
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/services/error-logger'
import { enqueueAsyncJob, triggerAsyncWorker } from '@/lib/services/queue'

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

    // Check if user wants auto-generation
    const { data: profile } = await supabase
      .from('profiles')
      .select('after_transcript_template_id, after_transcript_action')
      .eq('id', userId)
      .single()

    const templateId = (profile as any)?.after_transcript_template_id
    const legacyAction = profile?.after_transcript_action && profile.after_transcript_action !== 'nothing'
    if (!templateId && !legacyAction) {
      console.log('[Post-Transcribe] No auto-generation configured for user')
      return NextResponse.json({ ok: true, skipped: 'no_template' })
    }

    const job = await enqueueAsyncJob({
      userId,
      jobType: 'session_analyze',
      payload: { sessionId },
      idempotencyKey: `session_analyze:${sessionId}`,
      maxAttempts: 5,
    })
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
