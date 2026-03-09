import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const HARMFUL_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /pretend\s+you\s+are/i,
  /you\s+are\s+now/i,
  /jailbreak/i,
  /bypass\s+(safety|content|filter)/i,
  /generate\s+(harmful|illegal|violent|explicit)/i,
  /how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|drug)/i,
]

function checkSafety(fields: Record<string, string>): { level: 'pass' | 'warn' | 'fail'; score: number; flags: string[] } {
  const flags: string[] = []
  let score = 0

  const allText = Object.values(fields).join(' ')

  for (const pattern of HARMFUL_PATTERNS) {
    if (pattern.test(allText)) {
      flags.push(pattern.source)
      score += 3
    }
  }

  if (score === 0) return { level: 'pass', score: 0, flags: [] }
  if (score <= 3) return { level: 'warn', score, flags }
  return { level: 'fail', score, flags }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { fields } = body

  if (!fields) {
    return NextResponse.json({ error: 'Fields required' }, { status: 400 })
  }

  const { data: strikes } = await supabase
    .from('user_safety_strikes')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (strikes?.is_permanent) {
    return NextResponse.json({
      error: 'Account permanently blocked',
      details: 'Your account has been permanently blocked from publishing.',
    }, { status: 403 })
  }

  if (strikes?.blocked_until && new Date(strikes.blocked_until) > new Date()) {
    return NextResponse.json({
      error: 'Account temporarily blocked',
      details: `Blocked until ${strikes.blocked_until}`,
    }, { status: 403 })
  }

  const startTime = Date.now()
  const result = checkSafety(fields)
  const duration = Date.now() - startTime

  await supabase.from('prompt_check_log').insert({
    user_id: user.id,
    score: result.score,
    level: result.level,
    flags: result.flags,
    provider: 'pattern-match',
    duration_ms: duration,
  })

  if (result.level === 'fail') {
    const currentStrikes = (strikes?.strike_count ?? 0) + 1
    const isPermanent = currentStrikes >= 3
    const blockedUntil = isPermanent
      ? null
      : new Date(Date.now() + (currentStrikes === 1 ? 3600000 : 86400000)).toISOString()

    await supabase.from('user_safety_strikes').upsert({
      user_id: user.id,
      strike_count: currentStrikes,
      blocked_until: isPermanent ? null : blockedUntil,
      is_permanent: isPermanent,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({
      blocked: true,
      level: 'fail',
      strike_count: currentStrikes,
      details: result.flags.join(', '),
    })
  }

  return NextResponse.json({
    blocked: false,
    level: result.level,
    score: result.score,
    details: result.flags.length > 0 ? result.flags.join(', ') : undefined,
  })
}
