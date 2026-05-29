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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireCaseOwnership(params.id, user.id)
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))

    // Phase 2: project_type / user_role are owned by the case row itself
    // (cases.project_type / cases.user_role) and edited via the project edit
    // dialog. The pulse correction dialog only adjusts the AI-derived prose.
    const currentStatus = String(body?.currentStatus ?? body?.currentDirection ?? '').trim()
    const narrative = String(body?.narrative || '').trim()

    if (!currentStatus || !narrative) {
      return NextResponse.json(
        { error: 'currentStatus and narrative are required' },
        { status: 400 }
      )
    }

    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id, pulse, pulse_updated_at, pulse_version')
      .eq('id', params.id)
      .single()

    if (caseError || !caseRow) {
      return NextResponse.json({ error: caseError?.message || 'Case not found' }, { status: 404 })
    }

    if (!caseRow.pulse || typeof caseRow.pulse !== 'object') {
      return NextResponse.json(
        { error: 'Pulse is not available yet for manual correction' },
        { status: 409 }
      )
    }

    const nowIso = new Date().toISOString()
    const nextVersion = Number(caseRow.pulse_version || 0) + 1
    const nextPulse = {
      ...(caseRow.pulse as Record<string, unknown>),
      current_status: currentStatus,
      narrative,
      updated_at: nowIso,
      pulse_version: nextVersion,
      manually_corrected_at: nowIso,
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update({
        pulse: nextPulse,
        pulse_updated_at: nowIso,
        pulse_version: nextVersion,
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Best effort history snapshot for manual corrections as well.
    await supabase.from('project_pulse_history').insert({
      case_id: params.id,
      version: nextVersion,
      pulse: nextPulse,
    })

    return NextResponse.json({
      caseId: params.id,
      pulse: nextPulse,
      pulseUpdatedAt: nowIso,
      pulseVersion: nextVersion,
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

