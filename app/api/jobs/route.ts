import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: jobs, error } = await supabase
      .from('async_jobs')
      .select('id, job_type, status, payload, attempt_count, max_attempts, created_at, updated_at')
      .eq('user_id', user.id)
      .in('status', ['queued', 'running', 'retryable'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return NextResponse.json({
      jobs: (jobs || []).map((j) => ({
        id: j.id,
        jobType: j.job_type,
        status: j.status,
        sessionId: (j.payload as Record<string, unknown>)?.sessionId ?? null,
        attemptCount: j.attempt_count,
        maxAttempts: j.max_attempts,
        createdAt: j.created_at,
        updatedAt: j.updated_at,
      })),
    })
  } catch (error) {
    console.error('[Jobs API] List error:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}
