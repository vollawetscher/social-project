import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { createRoom, createRoomToken, generateRoomName } from '@/lib/services/livekit'
import { sendCommunicationHubEmail } from '@/lib/services/communication-hub-email'
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
    const {
      callType = 'web',
      mode = 'audio',
      participantName,
      calleeUserId,
      contactName,
      scheduledFor,
      scheduledTimezone,
      inviteEmail,
    } = body

    // Get user profile for display name, preferred language, and timezone
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email, default_recording_language, timezone')
      .eq('id', user.id)
      .single()

    const displayName = participantName || profile?.display_name || profile?.email || 'User'
    const roomName = generateRoomName()
    const isScheduled = Boolean(scheduledFor && callType === 'web' && mode === 'video')
    const roomCreatedAtMs = isScheduled ? null : Date.now()
    let scheduledForIso: string | null = null
    if (isScheduled) {
      const parsedSchedule = new Date(String(scheduledFor))
      if (Number.isNaN(parsedSchedule.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledFor datetime' }, { status: 400 })
      }
      scheduledForIso = parsedSchedule.toISOString()
      if (inviteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(inviteEmail).trim())) {
        return NextResponse.json({ error: 'Invalid invite email' }, { status: 400 })
      }
    }

    // Create the LiveKit room immediately only for instant calls.
    if (!isScheduled) {
      try {
        const isVideoCall = mode === 'video'
        await createRoom(roomName, {
          maxParticipants: 2,
          emptyTimeout: isVideoCall ? 900 : 90,
          metadata: JSON.stringify({ callType, mode, createdBy: user.id }),
        })
      } catch (lkError: any) {
        console.error('[Calls] LiveKit createRoom failed:', lkError)
        return NextResponse.json({ error: `LiveKit room creation failed: ${lkError.message}` }, { status: 500 })
      }
    }

    // Create a session for this call
    const inputHint =
      callType === 'pstn_outbound'
        ? 'phone_call'
        : mode === 'video'
          ? 'video_call'
          : 'phone_call'

    const sessionLabel =
      callType === 'pstn_outbound'
        ? 'Call'
        : mode === 'video'
          ? 'Video Call'
          : 'Audio Call'

    const session = !isScheduled
      ? await (async () => {
          const { data: createdSession, error: sessionError } = await supabase
            .from('sessions')
            .insert({
              user_id: user.id,
              status: 'created',
              context_note: '',
              internal_case_id: sessionLabel,
              duration_sec: 0,
              last_error: '',
              input_hint: inputHint,
              language: 'auto',
            })
            .select('id')
            .single()

          if (sessionError) {
            throw new Error(`Session creation failed: ${sessionError.message}`)
          }
          return createdSession
        })()
      : null

    // Create the call record
    const isInvite = !isScheduled && callType === 'web' && Boolean(calleeUserId)
    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        session_id: session?.id ?? null,
        user_id: user.id,
        callee_user_id: calleeUserId || null,
        room_name: roomName,
        call_type: callType,
        call_mode: mode,
        contact_name: contactName || null,
        status: isScheduled ? 'scheduled' : (isInvite ? 'invited' : 'waiting'),
        invited_at: isInvite ? new Date().toISOString() : null,
        participant_a_identity: user.id,
        room_created_at_ms: roomCreatedAtMs,
        scheduled_for: scheduledForIso,
        scheduled_timezone: scheduledTimezone || null,
        guest_invite_email: isScheduled ? (inviteEmail?.trim() || null) : null,
      })
      .select('*')
      .single()

    if (callError) {
      console.error('[Calls] Failed to create call record:', callError)
      return NextResponse.json({ error: `Call record creation failed: ${callError.message}` }, { status: 500 })
    }

    if (isScheduled) {
      let inviteEmailSent = false
      let inviteEmailError: string | null = null

      if (inviteEmail?.trim()) {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
          (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
          'http://localhost:3000'
        const joinUrl = `${baseUrl}/call/${call.room_name}?callId=${call.id}`
        const tz = scheduledTimezone || profile?.timezone || 'UTC'
        const startsAt = new Date(call.scheduled_for || scheduledForIso!).toLocaleString('de-DE', {
          timeZone: tz,
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        })
        const organizer = displayName
        const subject = call.contact_name?.trim()
          ? `Einladung: ${call.contact_name} – Notissima Video Call`
          : `Einladung: Notissima Video Call mit ${organizer}`
        const html = [
          `<p>Sie wurden zu einem Notissima Video Call eingeladen.</p>`,
          `<p><strong>Wann:</strong> ${startsAt}</p>`,
          call.contact_name?.trim() ? `<p><strong>Titel:</strong> ${call.contact_name}</p>` : '',
          `<p><strong>Organisator:</strong> ${organizer}</p>`,
          `<p><a href="${joinUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Jetzt beitreten</a></p>`,
          `<p style="color:#6b7280;font-size:12px;">Oder kopieren Sie diesen Link: ${joinUrl}</p>`,
        ].join('\n')
        const email = await sendCommunicationHubEmail({
          to: inviteEmail.trim(),
          subject,
          body: html,
        })
        inviteEmailSent = email.success
        inviteEmailError = email.success ? null : (email.error || 'Failed to send invite email')
      }

      return NextResponse.json({
        callId: call.id,
        roomName,
        sessionId: null,
        displayName,
        invited: false,
        scheduled: true,
        scheduledFor: scheduledForIso,
        inviteEmailSent,
        inviteEmailError,
      })
    }

    // Generate a LiveKit access token for the initiator
    let token: string
    try {
      token = await createRoomToken(roomName, user.id, displayName)
    } catch (tokenError: any) {
      console.error('[Calls] Token generation failed:', tokenError)
      return NextResponse.json({ error: `Token generation failed: ${tokenError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      callId: call.id,
      roomName,
      token,
      sessionId: session?.id ?? null,
      displayName,
      invited: isInvite,
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

    // Opportunistic cleanup: remove stale scheduled calls older than 1 hour.
    const staleThresholdIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    await supabase
      .from('calls')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'scheduled')
      .lt('scheduled_for', staleThresholdIso)

    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .or(`user_id.eq.${user.id},callee_user_id.eq.${user.id}`)
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
