import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { createSipParticipant } from '@/lib/services/livekit'
import type { DialRequest } from '@/lib/types/call'

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
    const { phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 })
    }

    // Validate E.164 format (basic check)
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      return NextResponse.json(
        { error: 'Phone number must be in E.164 format (e.g., +15551234567)' },
        { status: 400 }
      )
    }

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
    const sipParticipant = await createSipParticipant(call.room_name, phoneNumber, {
      participantIdentity: `sip-${phoneNumber}`,
      participantName: phoneNumber,
      playDialtone: true,
      ringingTimeout: 30,
    })

    // Update call record with PSTN info
    await supabase
      .from('calls')
      .update({
        call_type: 'pstn_outbound',
        phone_number: phoneNumber,
        sip_call_id: sipParticipant.participantId,
        participant_b_identity: `sip-${phoneNumber}`,
        status: 'active',
      })
      .eq('id', callId)

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
