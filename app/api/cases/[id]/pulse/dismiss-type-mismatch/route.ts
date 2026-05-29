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

// POST /api/cases/[id]/pulse/dismiss-type-mismatch
//
// Phase 2: clears `pulse.type_mismatch_suggestion` without bumping the
// pulse version (this is a UI-state action, not a content correction).
// The next pulse update may re-detect a mismatch on a future session, which
// is the correct behavior — dismiss only suppresses the current suggestion.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireCaseOwnership(params.id, user.id)
    const supabase = await createClient()

    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id, pulse')
      .eq('id', params.id)
      .single()

    if (caseError || !caseRow) {
      return NextResponse.json({ error: caseError?.message || 'Case not found' }, { status: 404 })
    }

    if (!caseRow.pulse || typeof caseRow.pulse !== 'object') {
      return NextResponse.json({ success: true, dismissed: false })
    }

    const nextPulse = {
      ...(caseRow.pulse as Record<string, unknown>),
      type_mismatch_suggestion: null,
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update({ pulse: nextPulse })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, dismissed: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
