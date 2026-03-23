import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createErrorLogger } from '@/lib/services/error-logger'
import {
  claimAsyncJobs,
  completeAsyncJob,
  retryAsyncJob,
  failAsyncJob,
  type AsyncJobRow,
} from '@/lib/services/queue'

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

  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
      'x-internal-user-id': job.user_id,
      'x-queue-worker': '1',
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(data?.error || `Session analyze failed (${response.status})`))
  }

  return {
    ...(typeof data === 'object' && data ? data : {}),
    sessionId,
  }
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

  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/transcribe`, {
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

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(data?.error || `Session transcribe failed (${response.status})`))
  }

  return {
    ...(typeof data === 'object' && data ? data : {}),
    sessionId,
  }
}

async function processJob(request: Request, job: AsyncJobRow): Promise<Record<string, unknown>> {
  switch (job.job_type) {
    case 'output_generate':
      return processOutputGenerateJob(request, job)
    case 'session_analyze':
      return processSessionAnalyzeJob(request, job)
    case 'session_transcribe':
      return processSessionTranscribeJob(request, job)
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
      try {
        const result = await processJob(request, job)
        await completeAsyncJob(job.id, result)
        processed.push({ id: job.id, status: 'completed' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown worker error'
        await errorLogger.log({
          errorType: 'server_error',
          severity: job.attempt_count >= job.max_attempts ? 'error' : 'warning',
          message: `[Async Queue] Job ${job.id} (${job.job_type}) failed: ${message}`,
          error,
          sessionId: typeof (job.payload as any)?.sessionId === 'string' ? (job.payload as any).sessionId : null,
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
          },
        }).catch(() => {})

        if (job.attempt_count >= job.max_attempts) {
          await failAsyncJob(job.id, message)
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

