import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { enqueueAsyncJob, linkJobToSession, triggerAsyncWorker } from '@/lib/services/queue'

/**
 * POST /api/sessions/[id]/owner-context
 *
 * Persists the session owner's answer to an analyzer-emitted clarification
 * ("who are you in this conversation?"), clears pending_clarification, and
 * kicks off a re-analyze so suggestions reflect the now-known context.
 *
 * Body shape:
 *   { context: { role: string, speakerId?: string|null, goal?: string|null,
 *                counterpartyRole?: string|null } }
 * or
 *   { dismiss: true }  // user chose to proceed without clarifying; clear the
 *                      // pending prompt and do not ask again for this session.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request)
    await requireSessionAccess(params.id, user.id)

    const body = await request.json().catch(() => ({}))
    const dismiss = Boolean((body as any)?.dismiss)
    const rawCtx = (body as any)?.context

    const supabase = await createClient()

    if (dismiss) {
      // Tombstone: store a "dismissed" marker so subsequent analyze runs do
      // not re-ask. The marker has no role/speakerId, so the generator will
      // treat outputs as neutral/observer by default.
      const tombstone = {
        source: 'dismissed' as const,
        updatedAt: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('sessions')
        .update({
          owner_context: tombstone,
          pending_clarification: null,
        })
        .eq('id', params.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, ownerContext: tombstone, cleared: true })
    }

    if (!rawCtx || typeof rawCtx !== 'object') {
      return NextResponse.json({ error: 'context is required' }, { status: 400 })
    }

    const role = String(rawCtx.role || '').trim()
    if (!role) {
      return NextResponse.json({ error: 'context.role is required' }, { status: 400 })
    }

    const nextOwnerContext = {
      role,
      speakerId: rawCtx.speakerId ? String(rawCtx.speakerId) : null,
      goal: rawCtx.goal ? String(rawCtx.goal) : null,
      counterpartyRole: rawCtx.counterpartyRole ? String(rawCtx.counterpartyRole) : null,
      source: 'user' as const,
      updatedAt: new Date().toISOString(),
    }

    // If the owner identified which speaker they are, label that speaker with
    // the owner's name in the transcript (unless a display name already exists).
    const sessionUpdate: Record<string, any> = {
      owner_context: nextOwnerContext,
      pending_clarification: null,
    }
    if (nextOwnerContext.speakerId) {
      const { data: sessionRow } = await supabase
        .from('sessions')
        .select('user_id, transcript_corrections')
        .eq('id', params.id)
        .single()
      const corrections = ((sessionRow as any)?.transcript_corrections || {}) as Record<string, any>
      const mergeMap = (corrections.speaker_merge_map || {}) as Record<string, string>
      const nameMap = { ...((corrections.speaker_name_map || corrections.name_corrections || {}) as Record<string, string>) }
      const resolvedLabel = mergeMap[nextOwnerContext.speakerId] || nextOwnerContext.speakerId
      if (!nameMap[resolvedLabel] || !String(nameMap[resolvedLabel]).trim()) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', (sessionRow as any)?.user_id)
          .maybeSingle()
        const ownerName = String((ownerProfile as any)?.display_name || '').trim()
        if (ownerName) {
          nameMap[resolvedLabel] = ownerName
          sessionUpdate.transcript_corrections = {
            ...corrections,
            speaker_name_map: nameMap,
            name_corrections: nameMap,
          }
        }
      }
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update(sessionUpdate)
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Re-run analyze via the async job queue so suggestions reflect the
    // new owner context. Self-fetching over HTTP doesn't work in Railway's
    // container network, so we enqueue a job the worker will pick up.
    // We delete any existing analyze job for this session first, otherwise
    // the idempotency key dedupes and the worker never runs.
    let reanalyzeJobId: string | null = null
    try {
      const svc = createServiceRoleClient()
      await svc
        .from('async_jobs')
        .delete()
        .eq('idempotency_key', `session_analyze:${params.id}`)

      const job = await enqueueAsyncJob({
        userId: user.id,
        jobType: 'session_analyze',
        payload: { sessionId: params.id },
        idempotencyKey: `session_analyze:${params.id}`,
        maxAttempts: 5,
      })
      await linkJobToSession(job.id, params.id)
      triggerAsyncWorker()
      reanalyzeJobId = job.id
      console.log('[OwnerContext] Re-analyze job enqueued:', job.id)
    } catch (err) {
      console.error('[OwnerContext] Failed to enqueue re-analyze:', err)
    }

    return NextResponse.json({
      success: true,
      ownerContext: nextOwnerContext,
      reanalyzeTriggered: Boolean(reanalyzeJobId),
      jobId: reanalyzeJobId,
    })
  } catch (error: any) {
    const handled = handleAuthError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.status })
  }
}
