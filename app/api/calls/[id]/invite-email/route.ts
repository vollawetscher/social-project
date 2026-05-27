import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { recordEmailInviteUsage } from '@/lib/services/usage-tracker'
import { sendCommunicationHubEmail } from '@/lib/services/communication-hub-email'
import { logError } from '@/lib/services/error-logger'
import { getAppBaseUrl } from '@/lib/utils/app-url'
import { buildInviteIcs } from '@/lib/utils/invite-ics'
import { formatScheduledCallTime } from '@/lib/utils/scheduled-call'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const callId = params.id
  let recipientEmail = ''
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))

    recipientEmail = String(body?.to || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json({ error: 'Invalid recipient email' }, { status: 400 })
    }

    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, user_id, room_name, scheduled_for, scheduled_duration_min, scheduled_timezone, contact_name')
      .eq('id', callId)
      .single()

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }
    if (call.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    if (!call.scheduled_for) {
      return NextResponse.json({ error: 'Call is not scheduled' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .single()

    const joinUrl = `${getAppBaseUrl()}/call/${call.room_name}?callId=${call.id}`
    const startAt = new Date(call.scheduled_for)
    const durationMin = Number(call.scheduled_duration_min || 30)
    const endAtIso = new Date(startAt.getTime() + durationMin * 60 * 1000).toISOString()
    const title = call.contact_name?.trim() || 'Notissima scheduled video call'
    const tz = call.scheduled_timezone || profile?.timezone || 'UTC'
    const when = formatScheduledCallTime(call.scheduled_for, tz)
    const html = `<p>You are invited to a scheduled Notissima video call.</p><p><strong>When:</strong> ${when}</p><p><strong>Duration:</strong> ${durationMin} min</p><p><a href="${joinUrl}">Join call</a></p>`
    const textBody = [
      'You are invited to a scheduled Notissima video call.',
      `When: ${when}`,
      `Duration: ${durationMin} min`,
      `Join link: ${joinUrl}`,
    ].join('\n')
    const ics = buildInviteIcs({
      uid: `${call.id}@notissima.app`,
      startIso: startAt.toISOString(),
      endIso: endAtIso,
      title,
      description: `You are invited to a scheduled Notissima video call.\n${joinUrl}`,
      joinUrl,
    })
    const icsBase64 = Buffer.from(ics, 'utf8').toString('base64')
    const response = await sendCommunicationHubEmail({
      to: recipientEmail,
      subject: title,
      body: html,
      textBody,
      attachments: [
        {
          filename: `notissima-invite-${call.id}.ics`,
          contentType: 'text/calendar; charset=utf-8',
          contentBase64: icsBase64,
        },
      ],
    })

    if (!response.success) {
      await logError({
        errorType: 'api_error',
        severity: 'error',
        message: `Invite email send failed for scheduled call ${call.id}`,
        userId: user.id,
        endpoint: '/api/calls/[id]/invite-email',
        method: 'POST',
        metadata: {
          callId: call.id,
          recipientEmail,
          provider: 'communication-hub',
          providerError: response.error || 'send_failed',
        },
      }).catch(() => {})

      recordEmailInviteUsage(supabase, user.id, {
        callId: call.id,
        recipientEmail,
        provider: 'communication-hub',
        success: false,
        error: response.error || 'send_failed',
      })
      return NextResponse.json({ error: 'Failed to send invite email' }, { status: 502 })
    }

    recordEmailInviteUsage(supabase, user.id, {
      callId: call.id,
      recipientEmail,
      provider: 'communication-hub',
      success: true,
    })

    return NextResponse.json({ ok: true, providerMessageId: response.providerMessageId || null })
  } catch (error) {
    await logError({
      errorType: 'server_error',
      severity: 'error',
      message: 'Unhandled error in scheduled invite email route',
      error,
      endpoint: '/api/calls/[id]/invite-email',
      method: 'POST',
      metadata: {
        callId,
        recipientEmail,
        provider: 'communication-hub',
      },
    }).catch(() => {})

    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      recordEmailInviteUsage(supabase, data?.user?.id ?? null, {
        callId,
        recipientEmail,
        provider: 'communication-hub',
        success: false,
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    } catch {
      // best-effort logging
    }

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

