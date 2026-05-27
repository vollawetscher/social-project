import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/calls/[id]/consent — Log transcription consent for a participant.
 * Open to both authenticated users and guests (no auth required).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const callId = params.id
    const body = await request.json()
    const { granted, participantName, participantIdentity } = body

    if (typeof granted !== 'boolean') {
      return NextResponse.json({ error: 'granted (boolean) is required' }, { status: 400 })
    }

    const db = createServiceRoleClient()

    if (participantIdentity) {
      const { data: existing } = await db
        .from('consent_logs')
        .select('id')
        .eq('call_id', callId)
        .eq('participant_identity', participantIdentity)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ success: true, duplicate: true })
      }
    }

    const { error } = await db.from('consent_logs').insert({
      call_id: callId,
      participant_name: participantName || '',
      participant_identity: participantIdentity || '',
      granted,
    })

    if (error?.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true })
    }

    if (error) {
      console.error('[Consent] Failed to log consent:', error)
      return NextResponse.json({ error: 'Failed to log consent' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Consent] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/calls/[id]/consent — Get consent status for all participants.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = createServiceRoleClient()

    const { data, error } = await db
      .from('consent_logs')
      .select('participant_name, participant_identity, granted, created_at')
      .eq('call_id', params.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Consent] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch consent' }, { status: 500 })
    }

    return NextResponse.json({ consents: data || [] })
  } catch (error: any) {
    console.error('[Consent] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
