import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRoomToken } from '@/lib/services/livekit'

/**
 * POST /api/calls/[id]/token - Generate a LiveKit access token for a call.
 * Supports both authenticated users and guest participants.
 * 
 * For authenticated users: identity is their user ID, name from profile.
 * For guests: pass { participantName: "Guest Name" } in the body.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: callId } = params
    const body = await request.json().catch(() => ({}))
    const { participantName } = body

    const supabase = await createClient()

    // Try to get authenticated user (optional for guest join)
    const { data: { user } } = await supabase.auth.getUser()

    // Look up the call
    // Use service role if the user is a guest (RLS would block them)
    let call
    if (user) {
      const { data } = await supabase
        .from('calls')
        .select('room_name, status, user_id')
        .eq('id', callId)
        .maybeSingle()
      call = data
    } else {
      // For guests, we need to bypass RLS to check call exists
      const { createServiceRoleClient } = await import('@/lib/supabase/server')
      const serviceSupabase = createServiceRoleClient()
      const { data } = await serviceSupabase
        .from('calls')
        .select('room_name, status, user_id')
        .eq('id', callId)
        .maybeSingle()
      call = data
    }

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Only allow joining if call is waiting or active
    if (call.status !== 'waiting' && call.status !== 'active') {
      return NextResponse.json({ error: 'Call is no longer active' }, { status: 410 })
    }

    // Determine identity and display name
    let identity: string
    let displayName: string

    if (user) {
      identity = user.id
      // Get display name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .single()
      displayName = participantName || profile?.display_name || profile?.email || 'User'
    } else {
      // Guest participant
      if (!participantName || participantName.trim().length === 0) {
        return NextResponse.json({ error: 'participantName is required for guest access' }, { status: 400 })
      }
      identity = `guest-${Date.now()}`
      displayName = participantName.trim()
    }

    const token = await createRoomToken(call.room_name, identity, displayName)

    return NextResponse.json({ token })
  } catch (error: any) {
    console.error('[Calls Token] Error:', error)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}
