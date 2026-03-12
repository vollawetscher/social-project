import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/calls/[id] - Get call status and details.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { id: callId } = params

    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    return NextResponse.json({ call })
  } catch (error: any) {
    console.error('[Calls] Error getting call:', error)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }

    return NextResponse.json({ error: 'Failed to get call' }, { status: 500 })
  }
}

/**
 * DELETE /api/calls/[id] - Delete a scheduled call owned by the user.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { id: callId } = params

    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, user_id, status, scheduled_for')
      .eq('id', callId)
      .maybeSingle()

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }
    if (call.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    if (!call.scheduled_for || call.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled calls can be deleted' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('calls')
      .delete()
      .eq('id', callId)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete scheduled call' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[Calls] Error deleting call:', error)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }

    return NextResponse.json({ error: 'Failed to delete call' }, { status: 500 })
  }
}
