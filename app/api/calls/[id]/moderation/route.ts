import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { listParticipants, removeParticipant } from '@/lib/services/livekit'

async function getOwnedCallOrThrow(callId: string, userId: string) {
  const db = createServiceRoleClient()
  const { data: call, error } = await db
    .from('calls')
    .select('id, user_id, room_name, room_locked')
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
    return NextResponse.json({
      roomLocked: Boolean(call.room_locked),
      participants: participants.map((p: any) => ({
        identity: p.identity,
        name: p.name || p.identity,
      })),
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
