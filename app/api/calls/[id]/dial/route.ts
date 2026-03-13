import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { placeConsentCall } from '@/lib/services/twilio-voice'
import { inferLocaleFromPhone } from '@/lib/services/locale-from-phone'
import { getAppBaseUrl } from '@/lib/utils/app-url'
import type { DialRequest } from '@/lib/types/call'

/**
 * POST /api/calls/[id]/dial - Start PSTN dial-out with forced consent.
 * Places a Twilio consent IVR call first; only after explicit consent do we
 * connect the callee to the LiveKit room via SIP.
 * Only the call owner can initiate this flow.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { id: callId } = params

    const body: DialRequest = await request.json()
    const { phoneNumber, contactName } = body as DialRequest & { contactName?: string }

    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 })
    }

    // Server-side normalization: strip formatting, 00→+, prepend + if missing
    let normalized = phoneNumber.replace(/[\s\-().]/g, '')
    if (normalized.startsWith('00')) normalized = '+' + normalized.slice(2)
    if (/^\d{7,15}$/.test(normalized)) normalized = '+' + normalized

    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      return NextResponse.json(
        { error: `"${phoneNumber}" is not a valid phone number. Use E.164 format, e.g. +491711234567` },
        { status: 400 }
      )
    }
    const phoneNumber_e164 = normalized

    // Look up the call and verify ownership
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (call.status !== 'waiting' && call.status !== 'active') {
      return NextResponse.json({ error: 'Call is no longer active' }, { status: 410 })
    }

    const locale = inferLocaleFromPhone(phoneNumber_e164)
    const appBaseUrl = getAppBaseUrl()
    // Twilio must reach a public HTTPS webhook URL.
    if (
      (process.env.NODE_ENV === 'production' && appBaseUrl.includes('localhost')) ||
      !/^https?:\/\//i.test(appBaseUrl)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid public app URL for Twilio consent webhook',
          details: 'Set NEXT_PUBLIC_APP_URL or RAILWAY_PUBLIC_DOMAIN to your public HTTPS domain.',
        },
        { status: 500 }
      )
    }

    const consentWebhookUrl = `${appBaseUrl}/api/calls/${callId}/pstn-consent?locale=${locale}`
    console.log('[Calls Dial] Twilio consent webhook URL:', consentWebhookUrl)
    const consentCall = await placeConsentCall({
      to: phoneNumber_e164,
      consentWebhookUrl,
    })

    if (!consentCall.success || !consentCall.callSid) {
      return NextResponse.json(
        { error: 'Failed to place consent call', details: consentCall.error },
        { status: 502 }
      )
    }

    // Update call record with PSTN info and consent state.
    // We do NOT create the SIP participant here; webhook flow will do that
    // only after explicit callee consent.
    await supabase
      .from('calls')
      .update({
        call_type: 'pstn_outbound',
        phone_number: phoneNumber_e164,
        participant_b_identity: `sip-${phoneNumber_e164}`,
        sip_call_id: null,
        pstn_consent_state: 'pending',
        callee_declined: false,
        ...(contactName ? { contact_name: contactName } : {}),
      })
      .eq('id', callId)

    if (call.session_id) {
      const label = contactName || phoneNumber_e164
      await supabase
        .from('sessions')
        .update({ internal_case_id: `Call ${label}` })
        .eq('id', call.session_id)
    }

    return NextResponse.json({
      consentCallSid: consentCall.callSid,
      consentPending: true,
    })
  } catch (error: any) {
    console.error('[Calls Dial] Error:', error)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }

    return NextResponse.json({ error: 'Failed to dial phone number' }, { status: 500 })
  }
}
