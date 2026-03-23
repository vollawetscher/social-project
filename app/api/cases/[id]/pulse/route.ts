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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireCaseOwnership(params.id, user.id)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('cases')
      .select('id, pulse, pulse_updated_at, pulse_version')
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Case not found' }, { status: 404 })
    }

    return NextResponse.json({
      caseId: data.id,
      pulse: data.pulse || null,
      pulseUpdatedAt: data.pulse_updated_at || null,
      pulseVersion: data.pulse_version || 0,
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

