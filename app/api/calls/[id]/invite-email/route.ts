import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { recordEmailInviteUsage } from '@/lib/services/usage-tracker'

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function buildInviteIcs(params: {
  callId: string
  startAt: string
  endAt: string
  title: string
  description: string
  joinUrl: string
}): string {
  const now = new Date()
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Notissima//Scheduled Calls//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${params.callId}@notissima.app`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(new Date(params.startAt))}`,
    `DTEND:${formatIcsDate(new Date(params.endAt))}`,
    `SUMMARY:${params.title}`,
    `DESCRIPTION:${params.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${params.joinUrl}`,
    `URL:${params.joinUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

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
      .select('id, user_id, room_name, scheduled_for, contact_name')
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

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.EMAIL_FROM
    if (!resendApiKey || !fromEmail) {
      return NextResponse.json(
        { error: 'Email provider not configured (RESEND_API_KEY and EMAIL_FROM required)' },
        { status: 501 }
      )
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
      'http://localhost:3000'

    const joinUrl = `${baseUrl}/call/${call.room_name}?callId=${call.id}`
    const startAt = new Date(call.scheduled_for)
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000)
    const title = call.contact_name?.trim() || 'Notissima scheduled video call'
    const description = `You are invited to a scheduled Notissima video call.\nJoin: ${joinUrl}`
    const ics = buildInviteIcs({
      callId: call.id,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      title,
      description,
      joinUrl,
    })

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: title,
        text: description,
        html: `<p>You are invited to a scheduled Notissima video call.</p><p><a href="${joinUrl}">Join call</a></p>`,
        attachments: [
          {
            filename: `notissima-invite-${call.id}.ics`,
            content: Buffer.from(ics, 'utf8').toString('base64'),
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      recordEmailInviteUsage(supabase, user.id, {
        callId: call.id,
        recipientEmail,
        provider: 'resend',
        success: false,
        error: errText || `HTTP ${response.status}`,
      })
      return NextResponse.json({ error: 'Failed to send invite email' }, { status: 502 })
    }

    const resendData = await response.json().catch(() => ({}))
    recordEmailInviteUsage(supabase, user.id, {
      callId: call.id,
      recipientEmail,
      provider: 'resend',
      success: true,
    })

    return NextResponse.json({ ok: true, providerMessageId: resendData?.id || null })
  } catch (error) {
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      recordEmailInviteUsage(supabase, data?.user?.id ?? null, {
        callId,
        recipientEmail,
        provider: 'resend',
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

