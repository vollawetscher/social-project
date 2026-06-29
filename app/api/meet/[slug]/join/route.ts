import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createRoom, createRoomToken, dispatchNotissimaVoiceAgent, generateRoomName } from '@/lib/services/livekit'
import { logImplicitPersonalLinkHostConsent } from '@/lib/services/call-consent'
import { getVoiceAgentSettingsForUser } from '@/lib/services/voice-agent'

/**
 * POST /api/meet/[slug]/join - Join a personal meeting room.
 *
 * Creates a LiveKit room and call record on-demand, then returns a token.
 * If the owner already has an active meeting room, joins that instead.
 *
 * Body: { visitorName: string, visitorEmail?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    if (!slug || slug.length < 2) {
      return NextResponse.json({ error: 'Invalid meeting link' }, { status: 400 })
    }

    const body = await request.json()
    const visitorName = String(body.visitorName || '').trim() || 'Guest'
    const visitorEmail = body.visitorEmail ? String(body.visitorEmail).trim() : null
    const isOwner = body.isOwner === true
    const guestIdentity = `guest-${Date.now()}`

    const supabase = createServiceRoleClient()

    const { data: owner, error: ownerError } = await supabase
      .from('profiles')
      .select('id, display_name, meeting_slug')
      .eq('meeting_slug', slug.toLowerCase())
      .maybeSingle()

    if (ownerError || !owner) {
      return NextResponse.json({ error: 'Meeting room not found' }, { status: 404 })
    }

    // Check for an existing active/waiting meeting room for this owner
    const { data: existingCall } = await supabase
      .from('calls')
      .select('id, room_name, session_id, status')
      .eq('user_id', owner.id)
      .like('room_name', 'meet-%')
      .in('status', ['waiting', 'invited', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let callId: string
    let roomName: string
    let sessionId: string | null

    if (existingCall) {
      callId = existingCall.id
      roomName = existingCall.room_name
      sessionId = existingCall.session_id

      if (isOwner && ['invited', 'active'].includes(existingCall.status)) {
        await logImplicitPersonalLinkHostConsent(supabase, {
          callId,
          hostUserId: owner.id,
          hostDisplayName: owner.display_name || 'Host',
        })
      }

      if (!isOwner) {
        await supabase
          .from('calls')
          .update({
            contact_name: visitorName,
            guest_invite_email: visitorEmail,
            callee_user_id: owner.id,
            status: existingCall.status === 'waiting' ? 'invited' : existingCall.status,
          })
          .eq('id', callId)
      }
    } else {
      // Create a new room + session + call
      roomName = `meet-${generateRoomName()}`

      try {
        await createRoom(roomName, {
          emptyTimeout: 900,
          metadata: JSON.stringify({ type: 'personal_meeting', ownerSlug: slug, createdBy: owner.id }),
        })
      } catch (lkError: any) {
        console.error('[Meet] LiveKit createRoom failed:', lkError)
        return NextResponse.json({ error: 'Failed to create meeting room' }, { status: 500 })
      }

      // Create a session for the owner
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: owner.id,
          status: 'created',
          context_note: '',
          internal_case_id: 'Video Call',
          duration_sec: 0,
          last_error: '',
          input_hint: 'video_call',
          language: 'auto',
          user_is_speaker: true,
        })
        .select('id')
        .single()

      if (sessionError) {
        console.error('[Meet] Session creation failed:', sessionError)
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
      }

      sessionId = session.id

      const { data: call, error: callError } = await supabase
        .from('calls')
        .insert({
          session_id: sessionId,
          user_id: owner.id,
          callee_user_id: isOwner ? null : owner.id,
          room_name: roomName,
          call_type: 'web',
          call_mode: 'video',
          contact_name: isOwner ? null : visitorName,
          guest_invite_email: isOwner ? null : visitorEmail,
          status: isOwner ? 'waiting' : 'invited',
          invited_at: isOwner ? null : new Date().toISOString(),
          participant_a_identity: isOwner ? owner.id : guestIdentity,
          room_created_at_ms: Date.now(),
        })
        .select('id')
        .single()

      if (callError) {
        console.error('[Meet] Call creation failed:', callError)
        return NextResponse.json({ error: 'Failed to create call' }, { status: 500 })
      }

      callId = call.id
    }

    const voiceAgent = await getVoiceAgentSettingsForUser(supabase, owner.id)
    console.log('[VoiceAgent Dispatch] /api/meet/[slug]/join check', {
      roomName,
      callId,
      ownerUserId: owner.id,
      isOwner,
      enabled: voiceAgent.enabled,
      wakeWord: voiceAgent.wakeWord,
      voiceId: voiceAgent.voiceId,
    })
    if (voiceAgent.enabled) {
      try {
        console.log('[VoiceAgent Dispatch] /api/meet/[slug]/join dispatching', {
          roomName,
          callId,
          ownerUserId: owner.id,
        })
        await dispatchNotissimaVoiceAgent(roomName, {
          ownerUserId: owner.id,
          callId,
          displayName: voiceAgent.displayName,
          wakeWord: voiceAgent.wakeWord,
          voiceId: voiceAgent.voiceId,
        })
      } catch (dispatchError: any) {
        console.error('[Meet] Failed to dispatch voice agent:', dispatchError?.message || dispatchError)
      }
    }

    const tokenIdentity = isOwner ? owner.id : guestIdentity
    const tokenName = isOwner ? (owner.display_name || 'Host') : visitorName
    const token = await createRoomToken(roomName, tokenIdentity, tokenName)

    return NextResponse.json({
      callId,
      roomName,
      token,
      sessionId,
      ownerName: owner.display_name || 'Host',
      participantIdentity: tokenIdentity,
      // The owner is the host of their personal meeting room; visitors who
      // arrive via the PML are calling them, so the visitor is the initiator.
      isInitiator: !isOwner,
    })
  } catch (error: any) {
    console.error('[Meet] Error joining meeting:', error)
    return NextResponse.json({ error: 'Failed to join meeting' }, { status: 500 })
  }
}
