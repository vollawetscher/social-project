import { createServiceRoleClient } from '@/lib/supabase/server'
import { enqueueAsyncJob, triggerAsyncWorker } from '@/lib/services/queue'

export function shouldEnqueuePulseForCaseChange(
  previousCaseId: string | null | undefined,
  nextCaseId: string | null | undefined
): boolean {
  const prev = previousCaseId || null
  const next = nextCaseId || null
  if (!next) return false
  if (prev === next) return false
  return true
}

export async function enqueuePulseUpdate(input: {
  caseId: string
  sessionId: string
  userId: string
  maxAttempts?: number
}) {
  const { caseId, sessionId, userId, maxAttempts = 8 } = input
  if (!caseId || !sessionId || !userId) return { queued: false, reason: 'missing_input' as const }

  const supabase = createServiceRoleClient()
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, status')
    .eq('id', caseId)
    .maybeSingle()

  if (!caseRow) return { queued: false, reason: 'case_missing' as const }
  if (caseRow.status === 'archived') return { queued: false, reason: 'archived_case' as const }

  const job = await enqueueAsyncJob({
    userId,
    jobType: 'pulse_update',
    payload: {
      projectId: caseId,
      sessionId,
    },
    maxAttempts,
  })
  triggerAsyncWorker()
  return { queued: true, jobId: job.id }
}

