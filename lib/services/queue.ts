import { createServiceRoleClient } from '@/lib/supabase/server'

export type AsyncJobType = 'output_generate' | 'session_analyze' | 'session_transcribe' | 'import_transcript_process'
export type AsyncJobStatus = 'queued' | 'running' | 'retryable' | 'completed' | 'failed'

export interface AsyncJobRow {
  id: string
  user_id: string
  job_type: AsyncJobType | string
  status: AsyncJobStatus
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  idempotency_key: string | null
  attempt_count: number
  max_attempts: number
  run_at: string
  last_error: string | null
  locked_at: string | null
  locked_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export async function enqueueAsyncJob(input: {
  userId: string
  jobType: AsyncJobType
  payload: Record<string, unknown>
  idempotencyKey?: string
  maxAttempts?: number
  runAt?: string
}): Promise<AsyncJobRow> {
  const supabase = createServiceRoleClient()
  const insertPayload = {
    user_id: input.userId,
    job_type: input.jobType,
    payload: input.payload,
    idempotency_key: input.idempotencyKey || null,
    max_attempts: input.maxAttempts || 5,
    ...(input.runAt ? { run_at: input.runAt } : {}),
  }

  const { data, error } = await supabase
    .from('async_jobs')
    .insert(insertPayload)
    .select('*')
    .single()

  if (!error && data) return data as AsyncJobRow

  // Unique idempotency conflict: return existing job.
  const message = String(error?.message || '')
  if (input.idempotencyKey && message.toLowerCase().includes('duplicate key')) {
    const { data: existing, error: existingError } = await supabase
      .from('async_jobs')
      .select('*')
      .eq('idempotency_key', input.idempotencyKey)
      .single()
    if (existingError || !existing) {
      throw existingError || new Error('Failed to fetch existing async job')
    }
    return existing as AsyncJobRow
  }

  throw error || new Error('Failed to enqueue async job')
}

export async function claimAsyncJobs(input: {
  workerId: string
  jobTypes?: AsyncJobType[]
  limit?: number
}): Promise<AsyncJobRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('claim_async_jobs', {
    p_worker_id: input.workerId,
    p_job_types: input.jobTypes || null,
    p_limit: input.limit || 10,
  })
  if (error) throw error
  return (data || []) as AsyncJobRow[]
}

export async function completeAsyncJob(jobId: string, result: Record<string, unknown>): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('async_jobs')
    .update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
  if (error) throw error
}

export async function retryAsyncJob(job: AsyncJobRow, message: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const attempt = Math.max(1, job.attempt_count)
  const delaySeconds = Math.min(900, 30 * Math.pow(2, attempt - 1))
  const runAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
  const { error } = await supabase
    .from('async_jobs')
    .update({
      status: 'retryable',
      run_at: runAt,
      last_error: message.slice(0, 1000),
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
  if (error) throw error
}

export async function failAsyncJob(jobId: string, message: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('async_jobs')
    .update({
      status: 'failed',
      last_error: message.slice(0, 1000),
      locked_at: null,
      locked_by: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
  if (error) throw error
}

export function triggerAsyncWorker(): void {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || null
  if (!baseUrl) return

  fetch(`${baseUrl}/api/internal/jobs/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ limit: 5 }),
  }).catch(() => {
    // Best-effort trigger only; scheduled workers can also drain queue.
  })
}

