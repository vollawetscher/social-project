import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

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
    const body = await request.json().catch(() => ({}))
    const loop = String(body?.loop || '').trim()
    if (!loop) {
      return NextResponse.json({ error: 'Loop is required' }, { status: 400 })
    }

    const { data: latestSession } = await supabase
      .from('sessions')
      .select('id, private_comments, context_note')
      .eq('case_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latestSession?.id) {
      return NextResponse.json({ error: 'No sessions found for this project' }, { status: 400 })
    }

    const marker = `[RESOLVED] ${loop}`
    const existingComments = String(latestSession.private_comments || '').trim()
    const existingContext = String(latestSession.context_note || '').trim()
    const baseText = existingComments || existingContext
    if (baseText.includes(marker)) {
      return NextResponse.json({ success: true, sessionId: latestSession.id, alreadyResolved: true })
    }

    const updatedComments = baseText ? `${baseText}\n${marker}` : marker
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ private_comments: updatedComments })
      .eq('id', latestSession.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, sessionId: latestSession.id })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

