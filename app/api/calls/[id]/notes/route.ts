import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/calls/[id]/notes
 * Saves post-call notes (context_note) to the session linked to this call.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { notes } = await request.json()

    const { data: call } = await supabase
      .from('calls')
      .select('id, session_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!call?.session_id) {
      return NextResponse.json({ error: 'Call or session not found' }, { status: 404 })
    }

    await supabase
      .from('sessions')
      .update({ context_note: notes || '' })
      .eq('id', call.session_id)

    console.log('[Calls Notes] Saved notes for session:', call.session_id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
