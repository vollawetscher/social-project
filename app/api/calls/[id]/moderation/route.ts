import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { listParticipants, removeParticipant } from '@/lib/services/livekit'

async function getOwnedCallOrThrow(callId: string, userId: string) {
  const db = createServiceRoleClient()
  const { data: call, error } = await db
    .from('calls')
    .select('id, user_id, room_name, room_locked, callee_user_id, participant_b_identity, contact_name')
    .eq('id', callId)
    .maybeSingle()
  if (error || !call) {
    return { db, call: null as any, notFound: true }
  }
  if (call.user_id !== userId) {
    return { db, call: null as any, forbidden: true }
  }
  return { db, call }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const { call, notFound, forbidden } = await getOwnedCallOrThrow(params.id, user.id)
    if (notFound) return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    if (forbidden) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const participants = await listParticipants(call.room_name).catch(() => [])
    const identities = participants
      .map((p: any) => (typeof p?.identity === 'string' ? p.identity.trim() : ''))
      .filter(Boolean)
    const uuidLike = identities.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    )
    const uniqueUuidLike = Array.from(new Set(uuidLike))
    const profileNameById: Record<string, string> = {}
    if (uniqueUuidLike.length > 0) {
      const { data: profiles } = await createServiceRoleClient()
        .from('profiles')
        .select('id, display_name, email')
        .in('id', uniqueUuidLike)
      for (const profile of profiles || []) {
        const name = profile.display_name || profile.email || null
        if (name) profileNameById[profile.id] = name
      }
    }

    const toRoleLabel = (identity: string) => {
      if (identity === call.user_id) return { role: 'host', roleLabel: 'Host' }
      if (identity === call.callee_user_id) return { role: 'invitee', roleLabel: 'Invited user' }
      if (call.participant_b_identity && identity === call.participant_b_identity) {
        return { role: 'invited-participant', roleLabel: 'Invited participant' }
      }
      if (identity.startsWith('sip-') || identity.startsWith('phone-') || identity.startsWith('+')) {
        return { role: 'phone', roleLabel: 'Phone participant' }
      }
      if (identity.startsWith('guest-')) return { role: 'guest', roleLabel: 'Guest' }
      return { role: 'participant', roleLabel: 'Participant' }
    }

    const toShortIdentity = (identity: string) =>
      identity.length > 18 ? `${identity.slice(0, 8)}...${identity.slice(-6)}` : identity

    return NextResponse.json({
      roomLocked: Boolean(call.room_locked),
      participants: participants.map((p: any) => {
        const identity = typeof p?.identity === 'string' ? p.identity : ''
        return {
          identity,
          name:
            profileNameById[identity] ||
            p?.name ||
            ((identity === call.participant_b_identity && call.contact_name) ? call.contact_name : null) ||
            toShortIdentity(identity || 'participant'),
          ...toRoleLabel(identity),
          shortIdentity: toShortIdentity(identity || 'participant'),
        }
      }),
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const { db, call, notFound, forbidden } = await getOwnedCallOrThrow(params.id, user.id)
    if (notFound) return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    if (forbidden) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const roomLocked = Boolean(body?.roomLocked)
    const { error } = await db
      .from('calls')
      .update({ room_locked: roomLocked })
      .eq('id', call.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, roomLocked })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const { call, notFound, forbidden } = await getOwnedCallOrThrow(params.id, user.id)
    if (notFound) return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    if (forbidden) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const identity = typeof body?.identity === 'string' ? body.identity.trim() : ''
    if (!identity) return NextResponse.json({ error: 'identity is required' }, { status: 400 })
    if (identity === user.id) return NextResponse.json({ error: 'Host cannot remove self' }, { status: 400 })

    await removeParticipant(call.room_name, identity)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status !== 500) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
      return NextResponse.json({ error: error.message || 'Failed to remove participant' }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
