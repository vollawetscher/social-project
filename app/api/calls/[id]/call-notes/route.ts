import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  computeNoteStartMs,
  parseTimedCallNotes,
  type TimedCallNote,
} from '@/lib/services/merge-call-notes'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const db = createServiceRoleClient()

    const { data: call } = await db
      .from('calls')
      .select('id, user_id, callee_user_id, timed_call_notes')
      .eq('id', params.id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (call.user_id !== user.id && call.callee_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      notes: parseTimedCallNotes(call.timed_call_notes),
      canAddNotes: call.user_id === user.id,
    })
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
    const db = createServiceRoleClient()
    const body = await request.json().catch(() => ({}))
    const text = typeof body?.text === 'string' ? body.text.trim() : ''

    if (!text) {
      return NextResponse.json({ error: 'Note text is required' }, { status: 400 })
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: 'Note is too long' }, { status: 400 })
    }

    const { data: call } = await db
      .from('calls')
      .select('id, user_id, started_at, room_created_at_ms, timed_call_notes')
      .eq('id', params.id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (call.user_id !== user.id) {
      return NextResponse.json({ error: 'Only the call host can add notes' }, { status: 403 })
    }

    if (!call.started_at) {
      return NextResponse.json({ error: 'Call has not started yet' }, { status: 400 })
    }

    const { data: profile } = await db
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()

    const authorName = profile?.display_name?.trim() || 'You'

    const existing = parseTimedCallNotes(call.timed_call_notes)
    const note: TimedCallNote = {
      id: randomUUID(),
      text,
      start_ms: computeNoteStartMs(call),
      author_name: authorName,
      created_at: new Date().toISOString(),
    }

    const nextNotes = [...existing, note]
    const { error } = await db
      .from('calls')
      .update({ timed_call_notes: nextNotes })
      .eq('id', call.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, note, notes: nextNotes })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
