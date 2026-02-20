import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { sendVideoCallInviteSMS } from '@/lib/services/sms'
import { placeNotificationCall } from '@/lib/services/twilio-voice'

/**
 * POST /api/calls/[id]/ring-sms
 * Sends an SMS invite link + places a short Twilio voice notification call.
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
      .select('room_name, user_id, call_type')
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

    if (!phoneNumber || !/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      return NextResponse.json({ error: 'Invalid phone number (E.164 required)' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
      || 'http://localhost:3000'

    const joinUrl = `${baseUrl}/call/${call.room_name}?callId=${callId}`

    const [smsResult, voiceResult] = await Promise.all([
      sendVideoCallInviteSMS(phoneNumber, callerName, joinUrl),
      placeNotificationCall(phoneNumber, callerName),
    ])

    console.log('[RingSMS] SMS:', smsResult.success ? 'sent' : smsResult.error,
                '| Voice:', voiceResult.success ? voiceResult.callSid : voiceResult.error)

    if (!smsResult.success && !voiceResult.success) {
      return NextResponse.json({
        error: 'Both SMS and voice call failed',
        smsError: smsResult.error,
        voiceError: voiceResult.error,
      }, { status: 502 })
    }

    return NextResponse.json({
      smsSent: smsResult.success,
      voiceCallPlaced: voiceResult.success,
      voiceCallSid: voiceResult.callSid,
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
