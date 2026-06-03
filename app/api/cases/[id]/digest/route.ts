import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { generateEventDigest } from '@/lib/services/event/event-digest'

async function loadOwnedCase(caseId: string, userId: string) {
  const supabase = await createClient()
  const { data: caseRow, error } = await supabase
    .from('cases')
    .select('id, user_id')
    .eq('id', caseId)
    .maybeSingle()
  if (error || !caseRow) return { ok: false as const, status: 404, message: 'Project not found' }
  if (caseRow.user_id !== userId) return { ok: false as const, status: 403, message: 'Unauthorized' }
  return { ok: true as const, supabase }
}

// GET /api/cases/[id]/digest - return the latest digest (or null).
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const owned = await loadOwnedCase(params.id, user.id)
    if (!owned.ok) return NextResponse.json({ error: owned.message }, { status: owned.status })

    const { data, error } = await owned.supabase
      .from('event_digests')
      .select('id, case_id, content, source_session_ids, version, created_at')
      .eq('case_id', params.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ digest: data || null })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/cases/[id]/digest - generate (or refresh) the digest.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const owned = await loadOwnedCase(params.id, user.id)
    if (!owned.ok) return NextResponse.json({ error: owned.message }, { status: owned.status })

    const result = await generateEventDigest({ supabase: owned.supabase, caseId: params.id })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status !== 500) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
