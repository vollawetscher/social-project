import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/helpers'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

type UsageEventType =
  | 'transcription_minutes'
  | 'ai_tokens_input'
  | 'ai_tokens_output'
  | 'ai_generations'
  | 'email_cost_usd'
  | 'sms_messages_attempted'
  | 'sms_messages_sent'
  | 'voice_calls_attempted'
  | 'voice_calls_connected'

interface UserCostRow {
  userId: string
  displayName: string | null
  email: string | null
  transcriptionMinutes: number
  aiInputTokens: number
  aiOutputTokens: number
  aiGenerations: number
  emailCostUsd: number
  estimatedCostUsd: number
}

const TRANSCRIPTION_COST_PER_MIN = 0.0278
const AI_INPUT_COST_PER_TOKEN = 0.000003
const AI_OUTPUT_COST_PER_TOKEN = 0.000015

function resolveFromDate(period: string): string {
  const now = new Date()
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  if (period === 'month') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    return d.toISOString()
  }
  return '1970-01-01'
}

/**
 * GET /api/admin/usage-costs
 * Admin-only per-user usage and estimated cost summary.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const fromDate = resolveFromDate(period)

    const service = createServiceRoleClient()
    const { data: events, error } = await service
      .from('usage_events')
      .select('user_id, event_type, amount')
      .gte('created_at', fromDate)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = new Map<string, UserCostRow>()
    for (const event of events || []) {
      const userId = String((event as any).user_id || '')
      if (!userId) continue
      if (!rows.has(userId)) {
        rows.set(userId, {
          userId,
          displayName: null,
          email: null,
          transcriptionMinutes: 0,
          aiInputTokens: 0,
          aiOutputTokens: 0,
          aiGenerations: 0,
          emailCostUsd: 0,
          estimatedCostUsd: 0,
        })
      }
      const row = rows.get(userId)!
      const eventType = String((event as any).event_type || '') as UsageEventType
      const amount = Number((event as any).amount || 0)

      if (eventType === 'transcription_minutes') row.transcriptionMinutes += amount
      if (eventType === 'ai_tokens_input') row.aiInputTokens += amount
      if (eventType === 'ai_tokens_output') row.aiOutputTokens += amount
      if (eventType === 'ai_generations') row.aiGenerations += amount
      if (eventType === 'email_cost_usd') row.emailCostUsd += amount
    }

    const userIds = Array.from(rows.keys())
    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from('profiles')
        .select('id, display_name, email')
        .in('id', userIds)

      for (const p of profiles || []) {
        const row = rows.get(p.id)
        if (!row) continue
        row.displayName = p.display_name || null
        row.email = p.email || null
      }
    }

    const costRows = Array.from(rows.values()).map((row) => {
      const transcriptionCost = row.transcriptionMinutes * TRANSCRIPTION_COST_PER_MIN
      const inputCost = row.aiInputTokens * AI_INPUT_COST_PER_TOKEN
      const outputCost = row.aiOutputTokens * AI_OUTPUT_COST_PER_TOKEN
      row.estimatedCostUsd = transcriptionCost + inputCost + outputCost + row.emailCostUsd
      return row
    })

    costRows.sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)

    const totals = costRows.reduce(
      (acc, row) => {
        acc.transcriptionMinutes += row.transcriptionMinutes
        acc.aiInputTokens += row.aiInputTokens
        acc.aiOutputTokens += row.aiOutputTokens
        acc.aiGenerations += row.aiGenerations
        acc.emailCostUsd += row.emailCostUsd
        acc.estimatedCostUsd += row.estimatedCostUsd
        return acc
      },
      {
        transcriptionMinutes: 0,
        aiInputTokens: 0,
        aiOutputTokens: 0,
        aiGenerations: 0,
        emailCostUsd: 0,
        estimatedCostUsd: 0,
      }
    )

    return NextResponse.json({
      period,
      fromDate,
      users: costRows,
      totals,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch usage costs' },
      { status: 500 }
    )
  }
}
