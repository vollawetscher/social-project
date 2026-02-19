import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/calls/[id]/info - Public minimal call info for invite links.
 * Returns only caller name and call mode -- no sensitive data.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = createServiceRoleClient()

    const { data: call, error } = await db
      .from('calls')
      .select('id, room_name, mode, user_id')
      .eq('id', params.id)
      .maybeSingle()

    if (error || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Fetch the caller's display name from profiles
    const { data: profile } = await db
      .from('profiles')
      .select('display_name, email')
      .eq('id', call.user_id)
      .maybeSingle()

    const callerName =
      profile?.display_name ||
      (profile?.email ? profile.email.split('@')[0] : null) ||
      'Someone'

    return NextResponse.json({ callerName, mode: call.mode })
  } catch (error: any) {
    console.error('[Call Info] Error:', error)
    return NextResponse.json({ callerName: 'Someone', mode: 'video' })
  }
}
