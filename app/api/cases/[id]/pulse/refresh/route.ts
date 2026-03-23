import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { enqueuePulseUpdate } from '@/lib/services/pulse/enqueue-pulse-update'

async function requireCaseOwnership(caseId: string, userId: string) {
  const supabase = await createClient()
  const { data: caseData, error } = await supabase
    .from('cases')
    .select('user_id')
    .eq('id', caseId)
    .maybeSingle()

  if (error || !caseData) throw new Error('Case not found')
  if (caseData.user_id !== userId) throw new Error('Unauthorized access to case')
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireCaseOwnership(params.id, user.id)
    const supabase = await createClient()

    const { data: latestSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('case_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latestSession?.id) {
      return NextResponse.json({ error: 'No sessions found for this project' }, { status: 400 })
    }

    const queued = await enqueuePulseUpdate({
      caseId: params.id,
      sessionId: latestSession.id,
      userId: user.id,
      maxAttempts: 3,
    })

    return NextResponse.json({
      queued: queued.queued,
      ...(queued.queued ? { jobId: queued.jobId } : { reason: queued.reason }),
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

