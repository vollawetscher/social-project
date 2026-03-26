import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/calls/[id]/info - Public minimal call info for invite links.
 * Returns only caller/call metadata needed for join UI.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = createServiceRoleClient()

    const { data: call, error } = await db
      .from('calls')
      .select('id, call_type, call_mode, pstn_transcription_mode, user_id')
      .eq('id', params.id)
      .maybeSingle()

    if (error || !call) {
      console.error('[Call Info] Call not found or query error:', error)
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Fetch the caller's display name from profiles
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('display_name, email')
      .eq('id', call.user_id)
      .maybeSingle()

    if (profileError) console.error('[Call Info] Profile lookup error:', profileError)

    const callerName =
      profile?.display_name ||
      (profile?.email ? profile.email.split('@')[0] : null) ||
      'Someone'

    return NextResponse.json({
      callerName,
      callType: call.call_type,
      callMode: call.call_mode || 'video',
      pstnTranscriptionMode: call.pstn_transcription_mode || 'batch',
    })
  } catch (error: any) {
    console.error('[Call Info] Error:', error)
    return NextResponse.json({ callerName: 'Someone', callMode: 'video', callType: 'web', pstnTranscriptionMode: 'batch' })
  }
}
