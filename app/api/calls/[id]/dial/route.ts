import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { createSipParticipant } from '@/lib/services/livekit'
import type { DialRequest } from '@/lib/types/call'
import { recordVoiceCallUsage } from '@/lib/services/usage-tracker'

/**
 * POST /api/calls/[id]/dial - Dial out to a phone number from within a call room.
 * Creates a SIP participant in the LiveKit room via the configured Twilio SIP trunk.
 * Only the call owner can initiate a PSTN dial-out.
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

    // Create SIP participant (dials out via Twilio)
    const sipParticipant = await createSipParticipant(call.room_name, phoneNumber_e164, {
      participantIdentity: `sip-${phoneNumber_e164}`,
      participantName: phoneNumber_e164,
      playDialtone: true,
      ringingTimeout: 90,
    })
    recordVoiceCallUsage(supabase, user.id, {
      success: true,
      callSid: sipParticipant.participantId,
      callId,
      endpoint: '/api/calls/[id]/dial',
      kind: 'pstn',
    })
    
    // Update call record with PSTN info.
    // Do NOT set status=active yet — wait for the SIP participant_joined webhook
    // which confirms the callee actually answered, then start egress.
    await supabase
      .from('calls')
      .update({
        call_type: 'pstn_outbound',
        phone_number: phoneNumber_e164,
        participant_b_identity: `sip-${phoneNumber_e164}`,
        sip_call_id: sipParticipant.participantId,
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
      sipCallId: sipParticipant.participantId,
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
