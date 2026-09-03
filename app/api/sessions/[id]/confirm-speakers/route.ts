/**
 * POST /api/sessions/[id]/confirm-speakers
 *
 * Releases the speaker-review gate. In ONE action it:
 *   - persists the user's confirmed speaker corrections (merge map, per-segment
 *     overrides, name map, word corrections),
 *   - persists the owner role answer (or keeps the inferred one / tombstones it),
 *   - clears pending_clarification,
 *   - flips status awaiting_speaker_review → done,
 *   - enqueues session_analyze once, on the now-confirmed speaker picture.
 *
 * Because owner_context is set here, the analyzer will not re-ask the role
 * question — the reconciliation gate already collected it.
 *
 * Body:
 *   {
 *     corrections?: {
 *       speaker_merge_map?: Record<string,string>,
 *       segment_speaker_overrides?: Record<string,string>,
 *       speaker_name_map?: Record<string,string>,
 *       word_corrections?: Record<string,string>
 *     },
 *     ownerContext?: { role: string, speakerId?, goal?, counterpartyRole? } | null,
 *     dismissClarification?: boolean
 *   }
 */
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { enqueueSessionAnalyzeWhenRoleReady } from '@/lib/services/session-analyze-gate'
import { applyListenerTranscriptAdjustments, isListenerOwnerRole } from '@/lib/utils/analysis-gate'
import { normalizeCorrectionMap } from '@/lib/utils/speaker-resolution'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request)
    await requireSessionAccess(params.id, user.id)

    const body = await request.json().catch(() => ({} as any))
    const supabase = await createClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('id, user_id, transcript_corrections, owner_context')
      .eq('id', params.id)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const existingCorrections = ((session as any)?.transcript_corrections || {}) as Record<string, any>
    const incoming = (body?.corrections || {}) as Record<string, any>

    const speakerMergeMap = normalizeCorrectionMap(incoming.speaker_merge_map)
    const segmentOverrides = normalizeCorrectionMap(incoming.segment_speaker_overrides)
    const speakerNameMap = normalizeCorrectionMap(incoming.speaker_name_map)
    const wordCorrections = normalizeCorrectionMap(incoming.word_corrections)

    // Owner context: explicit answer wins. A skip is observer — analysis must
    // not run without a role, and skip means "I am not claiming a speaker role".
    const existingOwnerContext = ((session as any)?.owner_context || null) as Record<string, any> | null
    let nextOwnerContext: Record<string, any> | null = existingOwnerContext
    const rawOwner = body?.ownerContext
    if (body?.dismissClarification === true && !rawOwner) {
      nextOwnerContext = {
        role: 'observer',
        speakerId: null,
        source: 'dismissed',
        updatedAt: new Date().toISOString(),
      }
    } else if (rawOwner && typeof rawOwner === 'object') {
      const role = String(rawOwner.role || '').trim()
      if (role) {
        nextOwnerContext = {
          role,
          speakerId: rawOwner.speakerId ? String(rawOwner.speakerId) : null,
          goal: rawOwner.goal ? String(rawOwner.goal) : null,
          counterpartyRole: rawOwner.counterpartyRole ? String(rawOwner.counterpartyRole) : null,
          source: 'user',
          updatedAt: new Date().toISOString(),
        }
      }
    }
    if (!nextOwnerContext || !String(nextOwnerContext.role || '').trim()) {
      nextOwnerContext = {
        role: 'observer',
        speakerId: null,
        source: 'dismissed',
        updatedAt: new Date().toISOString(),
      }
    }

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', (session as any).user_id)
      .maybeSingle()
    const ownerName = String((ownerProfile as any)?.display_name || '').trim()
    const listener = isListenerOwnerRole(nextOwnerContext)

    // Listener/recipient: do not stamp the owner's name onto acoustic labels.
    // Speaker role: label the chosen speaker unless the user already named it.
    const ownerSpeakerId = nextOwnerContext?.speakerId ? String(nextOwnerContext.speakerId).trim() : ''
    if (!listener && ownerSpeakerId) {
      const resolvedOwnerLabel = speakerMergeMap[ownerSpeakerId] || ownerSpeakerId
      if (!speakerNameMap[resolvedOwnerLabel] || !String(speakerNameMap[resolvedOwnerLabel]).trim()) {
        if (ownerName) speakerNameMap[resolvedOwnerLabel] = ownerName
      }
    }

    let nextCorrections: Record<string, any> = {
      ...existingCorrections,
      speaker_merge_map: speakerMergeMap,
      segment_speaker_overrides: segmentOverrides,
      speaker_name_map: speakerNameMap,
      name_corrections: speakerNameMap,
      word_corrections: wordCorrections,
      reconcile_merges: [],
    }
    if (listener && ownerName) {
      nextCorrections = applyListenerTranscriptAdjustments(nextCorrections, ownerName)
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        transcript_corrections: nextCorrections,
        owner_context: nextOwnerContext,
        pending_clarification: null,
        status: 'done',
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    let analyzeJobId: string | null = null
    try {
      const svc = createServiceRoleClient()
      const analyze = await enqueueSessionAnalyzeWhenRoleReady({
        supabase: svc,
        sessionId: params.id,
        userId: user.id,
        force: true,
      })
      analyzeJobId = analyze.jobId
    } catch (err) {
      console.error('[ConfirmSpeakers] Failed to enqueue analyze:', err)
    }

    return NextResponse.json({
      success: true,
      analyzeTriggered: Boolean(analyzeJobId),
      jobId: analyzeJobId,
      ownerContext: nextOwnerContext,
    })
  } catch (error: any) {
    const handled = handleAuthError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.status })
  }
}
