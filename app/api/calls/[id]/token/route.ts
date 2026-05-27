import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRoom } from '@/lib/services/livekit'
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
      .select('room_name, status, user_id, call_type, callee_user_id, accepted_at, scheduled_for, session_id, room_created_at_ms, call_mode, contact_name, room_locked')
      .eq('id', callId)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (
      call.status === 'scheduled' &&
      call.scheduled_for &&
      new Date(call.scheduled_for).getTime() - Date.now() > 10 * 60 * 1000
    ) {
      return NextResponse.json(
        {
          error: 'This scheduled call is not open yet',
          scheduledFor: call.scheduled_for,
          joinWindowMinutes: 10,
        },
        { status: 409 }
      )
    }

    // Lazily initialize room and session for scheduled calls on first join.
    if (call.status === 'scheduled' && !call.session_id) {
      try {
        await createRoom(call.room_name, {
          maxParticipants: 2,
          emptyTimeout: 900,
          metadata: JSON.stringify({ callType: 'web', mode: call.call_mode || 'video', scheduled: true, createdBy: call.user_id }),
        })
      } catch (lkError: any) {
        const msg = String(lkError?.message || '')
        // Race-safe: if another participant created it first, continue.
        if (!msg.toLowerCase().includes('already exists')) {
          console.error('[Calls Token] LiveKit createRoom failed for scheduled call:', lkError)
          return NextResponse.json({ error: `LiveKit room creation failed: ${lkError.message}` }, { status: 500 })
        }
      }

      const sessionLabel = call.contact_name?.trim() || 'Scheduled Video Call'
      const { data: session, error: sessionError } = await db
        .from('sessions')
        .insert({
          user_id: call.user_id,
          status: 'created',
          context_note: '',
          internal_case_id: sessionLabel,
          duration_sec: 0,
          last_error: '',
          input_hint: 'video_call',
          language: 'auto',
        })
        .select('id')
        .single()

      if (sessionError) {
        console.error('[Calls Token] Failed to create session for scheduled call:', sessionError)
        return NextResponse.json({ error: `Session creation failed: ${sessionError.message}` }, { status: 500 })
      }

      await db
        .from('calls')
        .update({
          session_id: session.id,
          status: call.callee_user_id ? 'invited' : 'waiting',
          room_created_at_ms: Date.now(),
          invited_at: call.callee_user_id ? new Date().toISOString() : null,
        })
        .eq('id', callId)
        .is('session_id', null)
    }

    // Only allow joining if call is still joinable
    const joinableStatuses = ['scheduled', 'invited', 'waiting', 'active', 'connected', 'recording']
    if (!joinableStatuses.includes(call.status)) {
      return NextResponse.json({ error: 'Call is no longer active' }, { status: 410 })
    }

    // Determine identity and display name
    let identity: string
    let displayName: string

    if (user) {
      if (call.room_locked && user.id !== call.user_id && call.callee_user_id !== user.id) {
        return NextResponse.json({ error: 'Call is locked by host' }, { status: 403 })
      }
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
      if (call.room_locked) {
        return NextResponse.json({ error: 'Call is locked by host' }, { status: 403 })
      }
      if (!participantName || participantName.trim().length === 0) {
        return NextResponse.json({ error: 'participantName is required for guest access' }, { status: 400 })
      }
      identity = `guest-${Date.now()}`
      displayName = participantName.trim()
    }

    const token = await createRoomToken(call.room_name, identity, displayName)

    // The "initiator" is the host who originally created the call (call.user_id).
    // Anyone else joining via this endpoint — guests opening a copied link,
    // scheduled-meeting recipients, in-app callees — is not the initiator and
    // should therefore not hear the outbound calling tone.
    const isInitiator = Boolean(user && user.id === call.user_id)

    return NextResponse.json({ token, isInitiator, participantIdentity: identity })
  } catch (error: any) {
    console.error('[Calls Token] Error:', error)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}
