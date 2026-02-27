import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/calls/[id]/heartbeat
 * Lightweight keepalive for active call pages.
 * Used to keep server-side call status fresh during mobile background/resume cycles.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: call } = await supabase
      .from('calls')
      .select('id, status, started_at')
      .eq('id', params.id)
      .or(`user_id.eq.${user.id},callee_user_id.eq.${user.id}`)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (call.status === 'waiting') updates.status = 'active'
    if (!call.started_at) updates.started_at = new Date().toISOString()

    if (Object.keys(updates).length > 0) {
      await supabase.from('calls').update(updates).eq('id', params.id)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
