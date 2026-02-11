/**
 * Beta usage summary API.
 * Returns aggregated transcription minutes and AI tokens for cost calculation.
 * Requires service role or admin - not exposed to end users.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // month | week | all
    const forUserId = searchParams.get('userId') // Optional: admin viewing specific user

    // For now, users can only see their own usage
    const userId = forUserId && forUserId !== user.id ? null : user.id
    if (!userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let fromDate: string
    const now = new Date()
    if (period === 'week') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      fromDate = d.toISOString()
    } else if (period === 'month') {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      fromDate = d.toISOString()
    } else {
      fromDate = '1970-01-01'
    }

    const { data: events, error } = await supabase
      .from('usage_events')
      .select('event_type, amount, unit, created_at')
      .eq('user_id', userId)
      .gte('created_at', fromDate)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Usage API] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
    }

    const summary = {
      transcription_minutes: 0,
      ai_tokens_input: 0,
      ai_tokens_output: 0,
      ai_generations: 0,
      period,
      fromDate,
      eventCount: events?.length ?? 0,
    }

    for (const e of events || []) {
      if (e.event_type === 'transcription_minutes') summary.transcription_minutes += Number(e.amount)
      if (e.event_type === 'ai_tokens_input') summary.ai_tokens_input += Number(e.amount)
      if (e.event_type === 'ai_tokens_output') summary.ai_tokens_output += Number(e.amount)
      if (e.event_type === 'ai_generations') summary.ai_generations += Number(e.amount)
    }

    return NextResponse.json(summary)
  } catch (err) {
    console.error('[Usage API] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
