/**
 * Usage tracking for beta phase.
 * Records transcription minutes and AI token usage for cost calculation and subscription modeling.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'

export type UsageEventType =
  | 'transcription_minutes'
  | 'ai_tokens_input'
  | 'ai_tokens_output'
  | 'ai_generations'
  | 'email_invites_attempted'
  | 'email_invites_sent'
  | 'email_cost_usd'

export interface UsageEvent {
  userId: string | null
  eventType: UsageEventType
  amount: number
  unit?: string
  metadata?: Record<string, unknown>
}

/** Record usage event. Non-blocking - logs errors but does not throw. */
export async function recordUsageEvent(
  supabase: SupabaseClient,
  event: UsageEvent
): Promise<void> {
  try {
    const { error } = await supabase.from('usage_events').insert({
      user_id: event.userId,
      event_type: event.eventType,
      amount: event.amount,
      unit: event.unit ?? (event.eventType === 'transcription_minutes' ? 'minutes' : event.eventType.startsWith('ai_tokens') ? 'tokens' : 'count'),
      metadata: event.metadata ?? {},
    })
    if (error) {
      console.error('[UsageTracker] Failed to record event:', error.message, event)
    }
  } catch (err) {
    console.error('[UsageTracker] Error recording usage:', err, event)
  }
}

/** Record transcription minutes (fire-and-forget). Use from API routes with user session. */
export function recordTranscriptionMinutes(
  supabase: SupabaseClient,
  userId: string | null,
  minutes: number,
  metadata?: { sessionId?: string }
): void {
  if (minutes <= 0) return
  void recordUsageEvent(supabase, {
    userId,
    eventType: 'transcription_minutes',
    amount: Math.round(minutes * 10000) / 10000, // 4 decimal places
    unit: 'minutes',
    metadata,
  })
}

/** Record transcription minutes from background job (uses service role). */
export function recordTranscriptionMinutesFromJob(
  userId: string | null,
  minutes: number,
  metadata?: { sessionId?: string }
): void {
  if (minutes <= 0) return
  try {
    const supabase = createServiceRoleClient()
    void recordUsageEvent(supabase, {
      userId,
      eventType: 'transcription_minutes',
      amount: Math.round(minutes * 10000) / 10000,
      unit: 'minutes',
      metadata,
    })
  } catch (err) {
    console.error('[UsageTracker] Failed to record transcription from job:', err)
  }
}

/** Record AI token usage (fire-and-forget). Use from API routes with user session. */
export function recordAiTokens(
  supabase: SupabaseClient,
  userId: string | null,
  inputTokens: number,
  outputTokens: number,
  metadata?: { sessionId?: string; outputId?: string; endpoint?: string }
): void {
  const total = inputTokens + outputTokens
  if (total <= 0) return

  void recordUsageEvent(supabase, {
    userId,
    eventType: 'ai_tokens_input',
    amount: inputTokens,
    unit: 'tokens',
    metadata,
  })
  void recordUsageEvent(supabase, {
    userId,
    eventType: 'ai_tokens_output',
    amount: outputTokens,
    unit: 'tokens',
    metadata,
  })
  void recordUsageEvent(supabase, {
    userId,
    eventType: 'ai_generations',
    amount: 1,
    unit: 'count',
    metadata,
  })
}

function resolveInviteCostUsd(): number {
  const raw = process.env.EMAIL_INVITE_COST_USD
  const parsed = raw ? Number(raw) : 0.0025
  if (!Number.isFinite(parsed) || parsed < 0) return 0.0025
  return parsed
}

/** Record server-side email invite attempt/result + estimated cost. */
export function recordEmailInviteUsage(
  supabase: SupabaseClient,
  userId: string | null,
  details: {
    callId?: string
    recipientEmail?: string
    provider?: string
    success: boolean
    error?: string
  }
): void {
  const metadata = {
    callId: details.callId,
    recipientEmail: details.recipientEmail,
    provider: details.provider ?? 'resend',
    success: details.success,
    error: details.error,
  }

  void recordUsageEvent(supabase, {
    userId,
    eventType: 'email_invites_attempted',
    amount: 1,
    unit: 'count',
    metadata,
  })

  if (details.success) {
    const estimatedCostUsd = resolveInviteCostUsd()
    void recordUsageEvent(supabase, {
      userId,
      eventType: 'email_invites_sent',
      amount: 1,
      unit: 'count',
      metadata,
    })
    void recordUsageEvent(supabase, {
      userId,
      eventType: 'email_cost_usd',
      amount: estimatedCostUsd,
      unit: 'usd',
      metadata: { ...metadata, estimatedCostUsd },
    })
  }
}
