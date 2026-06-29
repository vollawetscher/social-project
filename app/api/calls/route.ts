import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { createRoom, createRoomToken, dispatchNotissimaVoiceAgent, generateRoomName } from '@/lib/services/livekit'
import { sendCommunicationHubEmail } from '@/lib/services/communication-hub-email'
import { logError } from '@/lib/services/error-logger'
import { getAppBaseUrl } from '@/lib/utils/app-url'
import { buildInviteIcs } from '@/lib/utils/invite-ics'
import type { CreateCallRequest } from '@/lib/types/call'
import { getCalleeReachability } from '@/lib/services/call-reachability'
import { getVoiceAgentSettingsForUser } from '@/lib/services/voice-agent'

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
      pstnTranscriptionMode,
      participantName,
      calleeUserId,
      contactName,
      scheduledFor,
      scheduledDurationMin,
      scheduledTimezone,
      inviteEmail,
      inviteEmails,
      purpose,
    } = body
    const resolvedPstnTranscriptionMode =
      callType === 'pstn_outbound' && pstnTranscriptionMode === 'live'
        ? 'live'
        : 'batch'

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
    let normalizedScheduledDurationMin = 30
    let normalizedInviteEmails: string[] = []
    if (isScheduled) {
      const parsedSchedule = new Date(String(scheduledFor))
      if (Number.isNaN(parsedSchedule.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledFor datetime' }, { status: 400 })
      }
      if (parsedSchedule.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
      }
      scheduledForIso = parsedSchedule.toISOString()
      const combinedInviteEmails = Array.from(new Set([
        ...(Array.isArray(inviteEmails) ? inviteEmails : []),
        ...(inviteEmail ? [inviteEmail] : []),
      ]
        .map((e) => String(e || '').trim().toLowerCase())
        .filter(Boolean)))

      const invalidInviteEmail = combinedInviteEmails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      if (invalidInviteEmail) {
        return NextResponse.json({ error: `Invalid invite email: ${invalidInviteEmail}` }, { status: 400 })
      }
      normalizedInviteEmails = combinedInviteEmails

      const parsedDuration = Number(scheduledDurationMin ?? 30)
      if (!Number.isFinite(parsedDuration) || parsedDuration < 5 || parsedDuration > 24 * 60) {
        return NextResponse.json({ error: 'Invalid scheduled duration' }, { status: 400 })
      }
      normalizedScheduledDurationMin = Math.round(parsedDuration)
    }

    // Create the LiveKit room immediately only for instant calls.
    if (!isScheduled) {
      try {
        const isVideoCall = mode === 'video'
        await createRoom(roomName, {
          emptyTimeout: isVideoCall ? 900 : 90,
          metadata: JSON.stringify({ callType, mode, createdBy: user.id }),
        })
      } catch (lkError: any) {
        console.error('[Calls] LiveKit createRoom failed:', lkError)
        return NextResponse.json({ error: `LiveKit room creation failed: ${lkError.message}` }, { status: 500 })
      }
    }

    // Session is created later by the webhook when both participants connect
    // and recording starts. This avoids orphan sessions for missed/declined calls.

    // Create the call record
    const isInvite = !isScheduled && callType === 'web' && Boolean(calleeUserId)
    const calleeReachability = isInvite && calleeUserId
      ? await getCalleeReachability(createServiceRoleClient(), calleeUserId)
      : null
    const trimmedPurpose = typeof purpose === 'string' ? purpose.trim() : ''

    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        session_id: null,
        user_id: user.id,
        callee_user_id: calleeUserId || null,
        room_name: roomName,
        call_type: callType,
        call_mode: mode,
        pstn_transcription_mode: resolvedPstnTranscriptionMode,
        contact_name: contactName || null,
        status: isScheduled ? 'scheduled' : (isInvite ? 'invited' : 'waiting'),
        invited_at: isInvite ? new Date().toISOString() : null,
        participant_a_identity: user.id,
        room_created_at_ms: roomCreatedAtMs,
        scheduled_for: scheduledForIso,
        scheduled_duration_min: isScheduled ? normalizedScheduledDurationMin : null,
        scheduled_timezone: scheduledTimezone || null,
        guest_invite_email: isScheduled ? (normalizedInviteEmails[0] || null) : null,
        ...(trimmedPurpose ? { purpose: trimmedPurpose } : {}),
      })
      .select('*')
      .single()

    if (callError) {
      console.error('[Calls] Failed to create call record:', callError)
      return NextResponse.json({ error: `Call record creation failed: ${callError.message}` }, { status: 500 })
    }

    if (!isScheduled) {
      const voiceAgent = await getVoiceAgentSettingsForUser(supabase, user.id)
      if (voiceAgent.enabled) {
        try {
          await dispatchNotissimaVoiceAgent(roomName, {
            ownerUserId: user.id,
            callId: call.id,
            displayName: voiceAgent.displayName,
            wakeWord: voiceAgent.wakeWord,
            voiceId: voiceAgent.voiceId,
          })
        } catch (dispatchError: any) {
          console.error('[Calls] Failed to dispatch voice agent:', dispatchError?.message || dispatchError)
          await supabase
            .from('calls')
            .update({ last_error: `Voice agent dispatch failed: ${dispatchError?.message || 'unknown error'}` })
            .eq('id', call.id)
        }
      }
    }

    if (isScheduled) {
      let inviteEmailSent = false
      let inviteEmailError: string | null = null
      let inviteEmailsSentCount = 0
      let inviteEmailsFailedCount = 0
      const failedInviteEmails: string[] = []

      if (normalizedInviteEmails.length > 0) {
        const joinUrl = `${getAppBaseUrl()}/call/${call.room_name}?callId=${call.id}`
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
        const callTitle = call.contact_name?.trim() || 'Notissima Video Call'
        const icsTitle = call.purpose?.trim() || callTitle
        const subject = `${organizer} hat Sie zu einem Video Call eingeladen`
        const durationLabel = `${normalizedScheduledDurationMin} Min`
        const scheduledStartIso = call.scheduled_for || scheduledForIso!
        const scheduledEndIso = new Date(
          new Date(scheduledStartIso).getTime() + normalizedScheduledDurationMin * 60 * 1000
        ).toISOString()
        const html = [
          `<p>Hallo,</p>`,
          `<p><strong>${organizer}</strong> hat Sie zu einem Video Call eingeladen.</p>`,
          `<p><strong>Wann:</strong> ${startsAt}</p>`,
          `<p><strong>Dauer:</strong> ${durationLabel}</p>`,
          call.contact_name?.trim() ? `<p><strong>Betreff:</strong> ${callTitle}</p>` : '',
          `<p><a href="${joinUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Jetzt beitreten</a></p>`,
          `<p style="color:#6b7280;font-size:12px;">Link: ${joinUrl}</p>`,
        ].filter(Boolean).join('\n')
        const textBody = [
          `${organizer} hat Sie zu einem Video Call eingeladen.`,
          `Wann: ${startsAt}`,
          `Dauer: ${durationLabel}`,
          call.contact_name?.trim() ? `Betreff: ${callTitle}` : '',
          `Link: ${joinUrl}`,
        ].filter(Boolean).join('\n')
        const ics = buildInviteIcs({
          uid: `${call.id}@notissima.app`,
          startIso: scheduledStartIso,
          endIso: scheduledEndIso,
          title: icsTitle,
          description: `${organizer} hat Sie zu einem Video Call eingeladen.\n${joinUrl}`,
          joinUrl,
        })
        const icsBase64 = Buffer.from(ics, 'utf8').toString('base64')

        for (const recipient of normalizedInviteEmails) {
          const email = await sendCommunicationHubEmail({
            to: recipient,
            subject,
            body: html,
            fromName: 'Notissima',
            textBody,
            attachments: [
              {
                filename: `notissima-invite-${call.id}.ics`,
                contentType: 'text/calendar; charset=utf-8',
                contentBase64: icsBase64,
              },
            ],
          })
          if (email.success) {
            inviteEmailsSentCount += 1
            console.log(`[Calls] Invite email sent to ${recipient} for call ${call.id}`)
          } else {
            inviteEmailsFailedCount += 1
            failedInviteEmails.push(recipient)
            const providerError = email.error || 'Failed to send invite email'
            inviteEmailError = inviteEmailError || providerError
            console.error(`[Calls] Invite email FAILED for call ${call.id} to ${recipient}: ${providerError}`)
            await logError({
              errorType: 'api_error',
              severity: 'warning',
              message: `Guest invite email failed for scheduled call ${call.id}`,
              userId: user.id,
              endpoint: '/api/calls',
              method: 'POST',
              metadata: { callId: call.id, guestEmail: recipient, providerError },
            }).catch(() => {})
          }
        }

        inviteEmailSent = inviteEmailsSentCount > 0
        if (inviteEmailSent) {
          await supabase.from('calls').update({
            guest_invite_email_sent_at: new Date().toISOString(),
          }).eq('id', call.id)
        }
      }

      return NextResponse.json({
        callId: call.id,
        roomName,
        sessionId: null,
        displayName,
        invited: false,
        scheduled: true,
        scheduledFor: scheduledForIso,
        scheduledDurationMin: normalizedScheduledDurationMin,
        inviteEmailSent,
        inviteEmailError,
        inviteEmailsSentCount,
        inviteEmailsFailedCount,
        failedInviteEmails,
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
      sessionId: null,
      displayName,
      invited: isInvite,
      calleeReachability,
      isInitiator: true,
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
