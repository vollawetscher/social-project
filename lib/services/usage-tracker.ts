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
  | 'sms_messages_attempted'
  | 'sms_messages_sent'
  | 'voice_calls_attempted'
  | 'voice_calls_connected'

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

/** Record SMS attempt/result (provider-level billing surface). */
export function recordSmsUsage(
  supabase: SupabaseClient,
  userId: string | null,
  details: {
    provider: 'twilio' | 'seven'
    success: boolean
    callId?: string
    sessionId?: string
    phoneNumber?: string
    reason?: string
  }
): void {
  const metadata = {
    provider: details.provider,
    success: details.success,
    callId: details.callId,
    sessionId: details.sessionId,
    phoneNumber: details.phoneNumber,
    reason: details.reason,
  }

  void recordUsageEvent(supabase, {
    userId,
    eventType: 'sms_messages_attempted',
    amount: 1,
    unit: 'count',
    metadata,
  })

  if (details.success) {
    void recordUsageEvent(supabase, {
      userId,
      eventType: 'sms_messages_sent',
      amount: 1,
      unit: 'count',
      metadata,
    })
  }
}

/** Record Twilio voice call billing surface (attempt + connected). */
export function recordVoiceCallUsage(
  supabase: SupabaseClient,
  userId: string | null,
  details: {
    success: boolean
    callSid?: string
    callId?: string
    endpoint?: string
    reason?: string
    kind?: 'notification' | 'consent' | 'pstn'
  }
): void {
  const metadata = {
    success: details.success,
    callSid: details.callSid,
    callId: details.callId,
    endpoint: details.endpoint,
    reason: details.reason,
    kind: details.kind || 'pstn',
  }

  void recordUsageEvent(supabase, {
    userId,
    eventType: 'voice_calls_attempted',
    amount: 1,
    unit: 'count',
    metadata,
  })

  if (details.success) {
    void recordUsageEvent(supabase, {
      userId,
      eventType: 'voice_calls_connected',
      amount: 1,
      unit: 'count',
      metadata,
    })
  }
}
