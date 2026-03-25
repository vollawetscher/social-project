import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/helpers'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

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

    const service = createServiceRoleClient()
    const { data: aggregatedRows, error } = await service
      .from('usage_costs')
      .select(`
        user_id,
        transcription_minutes_all, ai_input_tokens_all, ai_output_tokens_all, ai_generations_all, email_cost_usd_all,
        transcription_minutes_30d, ai_input_tokens_30d, ai_output_tokens_30d, ai_generations_30d, email_cost_usd_30d,
        transcription_minutes_7d, ai_input_tokens_7d, ai_output_tokens_7d, ai_generations_7d, email_cost_usd_7d
      `)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const scope = period === 'week' ? '7d' : period === 'all' ? 'all' : '30d'
    const rows = new Map<string, UserCostRow>()
    for (const source of aggregatedRows || []) {
      const userId = String((source as any).user_id || '')
      if (!userId) continue
      let transcriptionMinutes = Number((source as any)[`transcription_minutes_${scope}`] || 0)
      let aiInputTokens = Number((source as any)[`ai_input_tokens_${scope}`] || 0)
      let aiOutputTokens = Number((source as any)[`ai_output_tokens_${scope}`] || 0)
      let aiGenerations = Number((source as any)[`ai_generations_${scope}`] || 0)
      let emailCostUsd = Number((source as any)[`email_cost_usd_${scope}`] || 0)

      // Defensive monotonicity guard:
      // "All time" should never show lower usage than "last 30 days".
      // This protects reporting against historical correction rows (e.g. negative adjustments)
      // and avoids confusing admin UX.
      if (scope === 'all') {
        transcriptionMinutes = Math.max(
          transcriptionMinutes,
          Number((source as any).transcription_minutes_30d || 0)
        )
        aiInputTokens = Math.max(
          aiInputTokens,
          Number((source as any).ai_input_tokens_30d || 0)
        )
        aiOutputTokens = Math.max(
          aiOutputTokens,
          Number((source as any).ai_output_tokens_30d || 0)
        )
        aiGenerations = Math.max(
          aiGenerations,
          Number((source as any).ai_generations_30d || 0)
        )
        emailCostUsd = Math.max(
          emailCostUsd,
          Number((source as any).email_cost_usd_30d || 0)
        )
      }

      rows.set(userId, {
        userId,
        displayName: null,
        email: null,
        transcriptionMinutes,
        aiInputTokens,
        aiOutputTokens,
        aiGenerations,
        emailCostUsd,
        estimatedCostUsd: 0,
      })
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
      source: 'usage_costs_view',
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
