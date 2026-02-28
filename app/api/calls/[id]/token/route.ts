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

    // Look up the call using service role — RLS on calls table only allows
    // the owner to read, but callees (authenticated or guest) also need access
    const { createServiceRoleClient } = await import('@/lib/supabase/server')
    const db = createServiceRoleClient()
    const { data: call } = await db
      .from('calls')
      .select('room_name, status, user_id, call_type, callee_user_id, accepted_at')
      .eq('id', callId)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Only allow joining if call is still joinable
    const joinableStatuses = ['invited', 'waiting', 'active', 'connected', 'recording']
    if (!joinableStatuses.includes(call.status)) {
      return NextResponse.json({ error: 'Call is no longer active' }, { status: 410 })
    }

    // Determine identity and display name
    let identity: string
    let displayName: string

    if (user) {
      if (call.call_type === 'web' && call.callee_user_id && user.id !== call.user_id) {
        if (call.callee_user_id !== user.id) {
          return NextResponse.json({ error: 'You are not the invited participant for this call' }, { status: 403 })
        }
        // Guard: invited user can only get token after accepting invite.
        if (!call.accepted_at && call.status !== 'active') {
          return NextResponse.json({ error: 'Invite must be accepted before joining' }, { status: 409 })
        }
      }

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
