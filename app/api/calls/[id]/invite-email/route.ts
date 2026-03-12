import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { recordEmailInviteUsage } from '@/lib/services/usage-tracker'
import { sendCommunicationHubEmail } from '@/lib/services/communication-hub-email'

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

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
      'http://localhost:3000'

    const joinUrl = `${baseUrl}/call/${call.room_name}?callId=${call.id}`
    const startAt = new Date(call.scheduled_for)
    const title = call.contact_name?.trim() || 'Notissima scheduled video call'
    const when = startAt.toLocaleString()
    const html = `<p>You are invited to a scheduled Notissima video call.</p><p><strong>When:</strong> ${when}</p><p><a href="${joinUrl}">Join call</a></p>`
    const response = await sendCommunicationHubEmail({
      to: recipientEmail,
      subject: title,
      body: html,
    })

    if (!response.success) {
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

