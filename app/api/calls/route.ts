import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { createRoom, createRoomToken, generateRoomName } from '@/lib/services/livekit'
import type { CreateCallRequest } from '@/lib/types/call'

/**
 * POST /api/calls - Create a new call room
 * Returns the call record, room name, and a LiveKit access token for the initiator.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const body: CreateCallRequest = await request.json()
    const { callType = 'web', mode = 'audio', participantName } = body

    // Get user profile for display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .single()

    const displayName = participantName || profile?.display_name || profile?.email || 'User'
    const roomName = generateRoomName()
    const roomCreatedAtMs = Date.now()

    // Create the LiveKit room
    await createRoom(roomName, {
      maxParticipants: 2,
      emptyTimeout: 300,
      metadata: JSON.stringify({ callType, mode, createdBy: user.id }),
    })

    // Create a session for this call (will hold transcript + analysis later)
    const inputHint = callType === 'pstn_outbound' ? 'phone_call' : 'video_call'
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        status: 'created',
        context_note: '',
        internal_case_id: '',
        duration_sec: 0,
        last_error: '',
        input_hint: inputHint,
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('[Calls] Failed to create session:', sessionError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Create the call record
    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        session_id: session.id,
        user_id: user.id,
        room_name: roomName,
        call_type: callType,
        status: 'waiting',
        participant_a_identity: user.id,
        room_created_at_ms: roomCreatedAtMs,
      })
      .select('*')
      .single()

    if (callError) {
      console.error('[Calls] Failed to create call:', callError)
      return NextResponse.json({ error: 'Failed to create call record' }, { status: 500 })
    }

    // Generate a LiveKit access token for the initiator
    const token = await createRoomToken(roomName, user.id, displayName)

    return NextResponse.json({
      callId: call.id,
      roomName,
      token,
      sessionId: session.id,
    })
  } catch (error: any) {
    console.error('[Calls] Error creating call:', error)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }

    return NextResponse.json({ error: error.message || 'Failed to create call' }, { status: 500 })
  }
}

/**
 * GET /api/calls - List calls for the authenticated user
 */
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[Calls] Error listing calls:', error)
      return NextResponse.json({ error: 'Failed to list calls' }, { status: 500 })
    }

    return NextResponse.json({ calls })
  } catch (error: any) {
    console.error('[Calls] Error listing calls:', error)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }

    return NextResponse.json({ error: 'Failed to list calls' }, { status: 500 })
  }
}
