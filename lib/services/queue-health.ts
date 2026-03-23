import type { SupabaseClient } from '@supabase/supabase-js'

export type QueueHealthStatus = 'healthy' | 'warning' | 'critical'

export interface QueueHealthSummary {
  status: QueueHealthStatus
  queuedCount: number
  retryableCount: number
  runningCount: number
  failedLastHour: number
  failedLast24h: number
  oldestQueuedAt: string | null
  oldestQueuedAgeMinutes: number | null
}

export async function getQueueHealthSummary(supabase: SupabaseClient): Promise<QueueHealthSummary> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    queuedCountRes,
    retryableCountRes,
    runningCountRes,
    failedHourRes,
    failedDayRes,
    oldestQueuedRes,
  ] = await Promise.all([
    supabase.from('async_jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
    supabase.from('async_jobs').select('id', { count: 'exact', head: true }).eq('status', 'retryable'),
    supabase.from('async_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    supabase
      .from('async_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('updated_at', oneHourAgo),
    supabase
      .from('async_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('updated_at', oneDayAgo),
    supabase
      .from('async_jobs')
      .select('created_at')
      .in('status', ['queued', 'retryable'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const queuedCount = queuedCountRes.count || 0
  const retryableCount = retryableCountRes.count || 0
  const runningCount = runningCountRes.count || 0
  const failedLastHour = failedHourRes.count || 0
  const failedLast24h = failedDayRes.count || 0
  const oldestQueuedAt = oldestQueuedRes.data?.created_at || null
  const oldestQueuedAgeMinutes = oldestQueuedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(oldestQueuedAt).getTime()) / 60000))
    : null

  let status: QueueHealthStatus = 'healthy'
  if (
    retryableCount >= 15 ||
    failedLastHour >= 6 ||
    (oldestQueuedAgeMinutes !== null && oldestQueuedAgeMinutes >= 20)
  ) {
    status = 'critical'
  } else if (
    retryableCount >= 5 ||
    failedLastHour >= 2 ||
    (oldestQueuedAgeMinutes !== null && oldestQueuedAgeMinutes >= 8)
  ) {
    status = 'warning'
  }

  return {
    status,
    queuedCount,
    retryableCount,
    runningCount,
    failedLastHour,
    failedLast24h,
    oldestQueuedAt,
    oldestQueuedAgeMinutes,
  }
}

