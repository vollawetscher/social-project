import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { deleteRoom } from '@/lib/services/livekit'

/**
 * POST /api/calls/[id]/end
 * Forcefully ends a call by deleting the LiveKit room.
 * This kicks all participants including SIP/Twilio legs so the PSTN call
 * is properly terminated and Twilio stops billing.
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
      .select('id, room_name, status')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Delete the LiveKit room — this terminates all participants including SIP legs
    try {
      await deleteRoom(call.room_name)
      console.log('[Calls End] Room deleted:', call.room_name)
    } catch (err: any) {
      // Room may already be gone — not a fatal error
      console.warn('[Calls End] deleteRoom warning:', err.message)
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
