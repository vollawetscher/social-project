import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createErrorLogger } from '@/lib/services/error-logger'
import {
  claimAsyncJobs,
  completeAsyncJob,
  retryAsyncJob,
  failAsyncJob,
  unlinkJobFromSession,
  type AsyncJobRow,
} from '@/lib/services/queue'
import { runPulseUpdateJob } from '@/lib/services/pulse/pulse-service'
import { hasReadyAnalysisArtifacts } from '@/lib/services/session-analysis'
import { enqueueSessionAnalyzeWhenRoleReady } from '@/lib/services/session-analyze-gate'

function getBaseUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    || new URL(request.url).origin
}

async function processOutputGenerateJob(request: Request, job: AsyncJobRow): Promise<Record<string, unknown>> {
  const payload = (job.payload || {}) as Record<string, unknown>
  const sessionId = String(payload.sessionId || '')
  const config = payload.config
  if (!sessionId || !config || typeof config !== 'object') {
    throw new Error('Invalid output_generate payload')
  }

  const baseUrl = getBaseUrl(request)
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is not configured')
  }

  const response = await fetch(`${baseUrl}/api/outputs/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
      'x-internal-user-id': job.user_id,
      'x-queue-worker': '1',
      'x-job-id': job.id,
    },
    body: JSON.stringify({
      sessionId,
      config,
      queueMode: 'sync',
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(data?.error || `Output generation failed (${response.status})`))
  }

  return {
    ...(typeof data === 'object' && data ? data : {}),
    outputId: data?.id || null,
  }
}

async function processSessionAnalyzeJob(request: Request, job: AsyncJobRow): Promise<Record<string, unknown>> {
  const payload = (job.payload || {}) as Record<string, unknown>
  const sessionId = String(payload.sessionId || '')
  if (!sessionId) {
    throw new Error('Invalid session_analyze payload')
  }

  const baseUrl = getBaseUrl(request)
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is not configured')
  }

  const force = payload.force === true
  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
      'x-internal-user-id': job.user_id,
      'x-queue-worker': '1',
      ...(force ? { 'x-analyze-force': '1' } : {}),
    },
    body: JSON.stringify({ force }),
  })

  const data = await response.json().catch(() => ({}))
  if (response.status === 409 && data?.error === 'owner_role_required') {
    return { skipped: 'owner_role_required', sessionId }
  }
  if (!response.ok) {
    const detail =
      typeof data?.message === 'string' && data.message.trim()
        ? `${data.error || 'Session analyze failed'}: ${data.message}`
        : data?.error
    throw new Error(String(detail || `Session analyze failed (${response.status})`))
  }

  return {
    ...(typeof data === 'object' && data ? data : {}),
    sessionId,
  }
}

async function processSessionReconcileJob(request: Request, job: AsyncJobRow): Promise<Record<string, unknown>> {
  const payload = (job.payload || {}) as Record<string, unknown>
  const sessionId = String(payload.sessionId || '')
  if (!sessionId) {
    throw new Error('Invalid session_reconcile payload')
  }

  const baseUrl = getBaseUrl(request)
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is not configured')
  }

  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/reconcile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
      'x-internal-user-id': job.user_id,
      'x-queue-worker': '1',
    },
    body: JSON.stringify({}),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail =
      typeof data?.message === 'string' && data.message.trim()
        ? `${data.error || 'Session reconcile failed'}: ${data.message}`
        : data?.error
    throw new Error(String(detail || `Session reconcile failed (${response.status})`))
  }

  return {
    ...(typeof data === 'object' && data ? data : {}),
    sessionId,
  }
}

async function hasTranscribeCompletedSince(sessionId: string, sinceIso: string): Promise<boolean> {
  const supabase = createServiceRoleClient()

  const { data: completedEvent } = await supabase
    .from('pipeline_events')
    .select('id')
    .eq('session_id', sessionId)
    .eq('stage', 'transcribe')
    .eq('event', 'job_completed')
    .gte('created_at', sinceIso)
    .limit(1)
    .maybeSingle()

  if (completedEvent?.id) return true

  const { data: transcriptRow } = await supabase
    .from('transcripts')
    .select('id')
    .eq('session_id', sessionId)
    .gte('created_at', sinceIso)
    .limit(1)
    .maybeSingle()

  return !!transcriptRow?.id
}

async function processSessionTranscribeJob(request: Request, job: AsyncJobRow): Promise<Record<string, unknown>> {
  const payload = (job.payload || {}) as Record<string, unknown>
  const sessionId = String(payload.sessionId || '')
  if (!sessionId) {
    throw new Error('Invalid session_transcribe payload')
  }

  const baseUrl = getBaseUrl(request)
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is not configured')
  }

  const startedAtIso = new Date().toISOString()
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/sessions/${sessionId}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
        'x-queue-worker': '1',
      },
      body: JSON.stringify({
        queueMode: 'sync',
      }),
    })
  } catch (error) {
    if (await hasTranscribeCompletedSince(sessionId, startedAtIso)) {
      return {
        sessionId,
        recoveredFromFetchFailure: true,
      }
    }
    throw error
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (await hasTranscribeCompletedSince(sessionId, startedAtIso)) {
      return {
        ...(typeof data === 'object' && data ? data : {}),
        sessionId,
        recoveredFromHttpError: response.status,
      }
    }
    throw new Error(String(data?.error || `Session transcribe failed (${response.status})`))
  }

  return {
    ...(typeof data === 'object' && data ? data : {}),
    sessionId,
  }
}

async function processImportTranscriptProcessJob(request: Request, job: AsyncJobRow): Promise<Record<string, unknown>> {
  const payload = (job.payload || {}) as Record<string, unknown>
  const baseUrl = getBaseUrl(request)
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is not configured')
  }

  const response = await fetch(`${baseUrl}/api/sessions/import-transcript`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
      'x-internal-user-id': job.user_id,
      'x-queue-worker': '1',
    },
    body: JSON.stringify({
      ...payload,
      queueMode: 'sync',
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(data?.error || `Import transcript processing failed (${response.status})`))
  }

  return {
    ...(typeof data === 'object' && data ? data : {}),
    sessionId: data?.session?.id || null,
  }
}

async function processPulseUpdateJob(job: AsyncJobRow): Promise<Record<string, unknown>> {
  const payload = (job.payload || {}) as Record<string, unknown>
  const projectId = String(payload.projectId || payload.caseId || '')
  const sessionId = String(payload.sessionId || '')
  if (!projectId || !sessionId) {
    throw new Error('Invalid pulse_update payload')
  }

  const supabase = createServiceRoleClient()
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id, status, recording_type, suggested_domains, ai_extracted_context')
    .eq('id', sessionId)
    .maybeSingle()

  const hasArtifacts = hasReadyAnalysisArtifacts(sessionRow)

  if (!hasArtifacts) {
    const status = String((sessionRow as any)?.status || '')
    // If analysis is not ready yet, ensure an analyze job exists.
    // Idempotency keeps this safe across retries.
    if (['done', 'ready', 'error'].includes(status)) {
      await enqueueSessionAnalyzeWhenRoleReady({
        supabase,
        sessionId,
        userId: job.user_id,
      })
    }
    throw new Error(`Pulse waiting for analysis artifacts (session=${sessionId}, status=${status || 'unknown'})`)
  }

  const result = await runPulseUpdateJob({
    supabase,
    caseId: projectId,
    sessionId,
  })

  return {
    projectId,
    sessionId,
    pulseVersion: result?.pulse?.pulse_version || null,
    sessionCount: result?.sessionCount || null,
    skipped: result?.skipped || null,
  }
}

async function processJob(request: Request, job: AsyncJobRow): Promise<Record<string, unknown>> {
  switch (job.job_type) {
    case 'output_generate':
      return processOutputGenerateJob(request, job)
    case 'session_analyze':
      return processSessionAnalyzeJob(request, job)
    case 'session_reconcile':
      return processSessionReconcileJob(request, job)
    case 'session_transcribe':
      return processSessionTranscribeJob(request, job)
    case 'import_transcript_process':
      return processImportTranscriptProcessJob(request, job)
    case 'pulse_update':
      return processPulseUpdateJob(job)
    default:
      throw new Error(`Unsupported job type: ${job.job_type}`)
  }
}

export async function POST(request: Request) {
  const internalSecret = request.headers.get('x-internal-secret')
  if (!process.env.INTERNAL_API_SECRET || internalSecret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const limit = Number(body?.limit || 10)
  const workerId = `worker-${Math.random().toString(36).slice(2, 10)}`
  const supabase = createServiceRoleClient()
  const errorLogger = await createErrorLogger(supabase)

  try {
    const jobs = await claimAsyncJobs({
      workerId,
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 25)) : 10,
    })

    const processed: Array<{ id: string; status: string }> = []
    for (const job of jobs) {
      const sessionId = typeof (job.payload as any)?.sessionId === 'string' ? (job.payload as any).sessionId : null

      try {
        const result = await processJob(request, job)
        await completeAsyncJob(job.id, result)
        if (sessionId) await unlinkJobFromSession(job.id, sessionId).catch(() => {})
        processed.push({ id: job.id, status: 'completed' })

        if (job.attempt_count > 1) {
          try {
            await supabase
              .from('error_logs')
              .update({ resolved: true, resolved_at: new Date().toISOString(), resolution_notes: 'Auto-resolved: job succeeded on retry' })
              .eq('resolved', false)
              .filter('metadata->>jobId', 'eq', job.id)
          } catch {}
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown worker error'
        await errorLogger.log({
          errorType: 'server_error',
          severity: job.attempt_count >= job.max_attempts ? 'error' : 'warning',
          message: `[Async Queue] Job ${job.id} (${job.job_type}) failed: ${message}`,
          error,
          sessionId,
          userId: job.user_id,
          endpoint: '/api/internal/jobs/run',
          method: 'POST',
          metadata: {
            workerId,
            jobId: job.id,
            jobType: job.job_type,
            attemptCount: job.attempt_count,
            maxAttempts: job.max_attempts,
            payload: job.payload || {},
            projectId: typeof (job.payload as any)?.projectId === 'string' ? (job.payload as any).projectId : null,
          },
        }).catch(() => {})

        if (job.attempt_count >= job.max_attempts) {
          await failAsyncJob(job.id, message)
          if (sessionId) {
            await unlinkJobFromSession(job.id, sessionId).catch(() => {})
            try {
              await supabase
                .from('sessions')
                .update({ status: 'error', last_error: `Job ${job.job_type} failed after ${job.max_attempts} attempts: ${message.slice(0, 500)}` })
                .eq('id', sessionId)
            } catch {}
          }
          processed.push({ id: job.id, status: 'failed' })
        } else {
          await retryAsyncJob(job, message)
          processed.push({ id: job.id, status: 'retryable' })
        }
      }
    }

    return NextResponse.json({
      success: true,
      claimed: jobs.length,
      processed,
    })
  } catch (error) {
    console.error('[Internal Jobs Run] Error:', error)
    await errorLogger.log({
      errorType: 'server_error',
      severity: 'error',
      message: `[Async Queue] Worker execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error,
      endpoint: '/api/internal/jobs/run',
      method: 'POST',
      metadata: {
        workerId,
        requestedLimit: limit,
      },
    }).catch(() => {})
    return NextResponse.json({ error: 'Failed to run async jobs' }, { status: 500 })
  }
}

