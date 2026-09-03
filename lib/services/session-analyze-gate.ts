import { enqueueAsyncJob, linkJobToSession, triggerAsyncWorker } from '@/lib/services/queue'
import {
  hasConfirmedOwnerRole,
  resolveAutoOwnerContext,
  uniqueSpeakerLabels,
} from '@/lib/utils/analysis-gate'

type SupabaseLike = {
  from: (table: string) => any
}

export async function enqueueSessionAnalyzeWhenRoleReady(params: {
  supabase: SupabaseLike
  sessionId: string
  userId: string
  segments?: Array<{ speaker?: string; isCallNote?: boolean }>
  force?: boolean
  /** Used when the caller already knows the role (voice-agent owner is the user). */
  fallbackRole?: { role: string; speakerId?: string | null; source?: string }
}): Promise<{ queued: boolean; gated: boolean; jobId: string | null; ownerContext: Record<string, any> | null }> {
  const { data: session } = await params.supabase
    .from('sessions')
    .select('id, owner_context, user_is_speaker, input_hint, transcript_corrections')
    .eq('id', params.sessionId)
    .maybeSingle()

  if (!session) {
    return { queued: false, gated: false, jobId: null, ownerContext: null }
  }

  let ownerContext = ((session as any).owner_context || null) as Record<string, any> | null
  const speakers = uniqueSpeakerLabels(params.segments || [])

  if (!hasConfirmedOwnerRole(ownerContext)) {
    const auto =
      resolveAutoOwnerContext({
        ownerContext,
        userIsSpeaker: (session as any).user_is_speaker,
        inputHint: (session as any).input_hint,
        speakers,
      }) ||
      (params.fallbackRole
        ? {
            role: params.fallbackRole.role,
            speakerId: params.fallbackRole.speakerId ?? null,
            source: params.fallbackRole.source || 'auto',
            updatedAt: new Date().toISOString(),
          }
        : null)

    if (auto) {
      ownerContext = auto
      await params.supabase
        .from('sessions')
        .update({ owner_context: auto })
        .eq('id', params.sessionId)
    } else {
      await params.supabase
        .from('sessions')
        .update({ status: 'awaiting_speaker_review' })
        .eq('id', params.sessionId)
      return { queued: false, gated: true, jobId: null, ownerContext }
    }
  }

  if (params.force) {
    await params.supabase
      .from('async_jobs')
      .delete()
      .eq('idempotency_key', `session_analyze:${params.sessionId}`)
  }

  const job = await enqueueAsyncJob({
    userId: params.userId,
    jobType: 'session_analyze',
    payload: { sessionId: params.sessionId, force: Boolean(params.force) },
    idempotencyKey: `session_analyze:${params.sessionId}`,
    maxAttempts: 5,
  })
  await linkJobToSession(job.id, params.sessionId)
  triggerAsyncWorker()
  return { queued: true, gated: false, jobId: job.id, ownerContext }
}
