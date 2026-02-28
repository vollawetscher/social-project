import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { sendVideoCallInviteSMS } from '@/lib/services/sms'
import { placeNotificationCall, waitForCallAnswered } from '@/lib/services/twilio-voice'
import { inferLocaleFromPhone } from '@/lib/services/locale-from-phone'

/**
 * POST /api/calls/[id]/ring-sms
 * Places a short Twilio notification call first, then sends SMS a few seconds
 * after the callee answers.
 * Body: { phoneNumber: string, callerName?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const callId = params.id

    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('room_name, user_id, call_type, session_id')
      .eq('id', callId)
      .single()

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }
    if (call.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const phoneNumber: string = body.phoneNumber
    const callerName: string = body.callerName || 'Someone'
    const contactName: string | undefined = body.contactName

    if (!phoneNumber || !/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      return NextResponse.json({ error: 'Invalid phone number (E.164 required)' }, { status: 400 })
    }
    const locale = inferLocaleFromPhone(phoneNumber)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
      || 'http://localhost:3000'

    const joinUrl = `${baseUrl}/call/${call.room_name}?callId=${callId}`

    // Place voice call first. SMS will be sent only after answer.
    const voiceResult = await placeNotificationCall(phoneNumber, callerName, locale)
    console.log('[RingSMS] Voice:', voiceResult.success ? voiceResult.callSid : voiceResult.error)

    if (!voiceResult.success || !voiceResult.callSid) {
      return NextResponse.json(
        { error: 'Failed to place notification call', voiceError: voiceResult.error },
        { status: 502 }
      )
    }

    const answerResult = await waitForCallAnswered(voiceResult.callSid, {
      timeoutMs: 45_000,
      pollIntervalMs: 2_000,
    })

    if (!answerResult.answered) {
      return NextResponse.json(
        {
          error: 'Call was not answered; SMS not sent',
          callStatus: answerResult.status,
          details: answerResult.error,
        },
        { status: 409 }
      )
    }

    // Give the callee a short moment after answering before sending text.
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const smsResult = await sendVideoCallInviteSMS(phoneNumber, callerName, joinUrl, locale)
    console.log('[RingSMS] SMS:', smsResult.success ? 'sent' : smsResult.error)

    if (call.session_id) {
      const label = contactName || phoneNumber
      await supabase
        .from('sessions')
        .update({ internal_case_id: `Call ${label}` })
        .eq('id', call.session_id)
    }

    if (!smsResult.success) {
      return NextResponse.json({
        error: 'SMS failed after call was answered',
        smsError: smsResult.error,
      }, { status: 502 })
    }

    return NextResponse.json({
      smsSent: smsResult.success,
      voiceCallPlaced: voiceResult.success,
      voiceCallSid: voiceResult.callSid,
      callAnswered: true,
    })
  } catch (error: any) {
    console.error('[RingSMS] Error:', error)
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status !== 500) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
