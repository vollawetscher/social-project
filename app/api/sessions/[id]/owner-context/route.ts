import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { enqueueSessionAnalyzeWhenRoleReady } from '@/lib/services/session-analyze-gate'
import { applyListenerTranscriptAdjustments, isListenerOwnerRole } from '@/lib/utils/analysis-gate'

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
      const tombstone = {
        role: 'observer',
        speakerId: null,
        source: 'dismissed' as const,
        updatedAt: new Date().toISOString(),
      }
      const { data: sessionRow } = await supabase
        .from('sessions')
        .select('user_id, transcript_corrections')
        .eq('id', params.id)
        .single()
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', (sessionRow as any)?.user_id)
        .maybeSingle()
      const ownerName = String((ownerProfile as any)?.display_name || '').trim()
      const corrections = ownerName
        ? applyListenerTranscriptAdjustments((sessionRow as any)?.transcript_corrections, ownerName)
        : (sessionRow as any)?.transcript_corrections
      const { error } = await supabase
        .from('sessions')
        .update({
          owner_context: tombstone,
          pending_clarification: null,
          ...(corrections ? { transcript_corrections: corrections } : {}),
        })
        .eq('id', params.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      let jobId: string | null = null
      try {
        const analyze = await enqueueSessionAnalyzeWhenRoleReady({
          supabase: createServiceRoleClient(),
          sessionId: params.id,
          userId: user.id,
          force: true,
        })
        jobId = analyze.jobId
      } catch (err) {
        console.error('[OwnerContext] Failed to enqueue analyze after dismiss:', err)
      }
      return NextResponse.json({ success: true, ownerContext: tombstone, cleared: true, jobId })
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

    const sessionUpdate: Record<string, any> = {
      owner_context: nextOwnerContext,
      pending_clarification: null,
    }
    const { data: sessionRow } = await supabase
      .from('sessions')
      .select('user_id, transcript_corrections')
      .eq('id', params.id)
      .single()
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', (sessionRow as any)?.user_id)
      .maybeSingle()
    const ownerName = String((ownerProfile as any)?.display_name || '').trim()
    const corrections = ((sessionRow as any)?.transcript_corrections || {}) as Record<string, any>
    if (isListenerOwnerRole(nextOwnerContext) && ownerName) {
      sessionUpdate.transcript_corrections = applyListenerTranscriptAdjustments(corrections, ownerName)
    } else if (nextOwnerContext.speakerId) {
      const mergeMap = (corrections.speaker_merge_map || {}) as Record<string, string>
      const nameMap = { ...((corrections.speaker_name_map || corrections.name_corrections || {}) as Record<string, string>) }
      const resolvedLabel = mergeMap[nextOwnerContext.speakerId] || nextOwnerContext.speakerId
      if (ownerName && (!nameMap[resolvedLabel] || !String(nameMap[resolvedLabel]).trim())) {
        nameMap[resolvedLabel] = ownerName
        sessionUpdate.transcript_corrections = {
          ...corrections,
          speaker_name_map: nameMap,
          name_corrections: nameMap,
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

    let reanalyzeJobId: string | null = null
    try {
      const analyze = await enqueueSessionAnalyzeWhenRoleReady({
        supabase: createServiceRoleClient(),
        sessionId: params.id,
        userId: user.id,
        force: true,
      })
      reanalyzeJobId = analyze.jobId
      console.log('[OwnerContext] Re-analyze job enqueued:', analyze.jobId)
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
