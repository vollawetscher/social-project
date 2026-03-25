import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'

export type PipelineSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical'

export interface PipelineEventInput {
  sessionId?: string | null
  caseId?: string | null
  userId?: string | null
  stage: string
  event: string
  severity?: PipelineSeverity
  metadata?: Record<string, unknown>
}

export async function logPipelineEvent(
  input: PipelineEventInput,
  supabase?: SupabaseClient
): Promise<void> {
  try {
    const db = supabase || createServiceRoleClient()
    const { error } = await db
      .from('pipeline_events')
      .insert({
        session_id: input.sessionId || null,
        case_id: input.caseId || null,
        user_id: input.userId || null,
        stage: input.stage,
        event: input.event,
        severity: input.severity || 'info',
        metadata: input.metadata || {},
      })
    if (error) {
      console.warn('[PipelineLogger] Failed to persist event:', error.message, input)
    }
  } catch (err) {
    console.warn('[PipelineLogger] Error while logging event:', err)
  }
}
