import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerAsyncWorker } from '@/lib/services/queue'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: job, error } = await supabase
      .from('async_jobs')
      .select('id, user_id, job_type, status, result, last_error, attempt_count, max_attempts, created_at, updated_at, completed_at')
      .eq('id', params.id)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.user_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
    }

    if (job.status === 'queued' || job.status === 'retryable' || job.status === 'running') {
      triggerAsyncWorker()
    }

    return NextResponse.json({
      id: job.id,
      jobType: job.job_type,
      status: job.status,
      result: job.result,
      lastError: job.last_error,
      attemptCount: job.attempt_count,
      maxAttempts: job.max_attempts,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
    })
  } catch (error) {
    console.error('[Jobs API] Error:', error)
    return NextResponse.json({ error: 'Failed to load job' }, { status: 500 })
  }
}

