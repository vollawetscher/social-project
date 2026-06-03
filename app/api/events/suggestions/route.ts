import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import {
  clusterSessions,
  type ClusterableSession,
  type EventCluster,
} from '@/lib/services/event/event-clustering'

// GET /api/events/suggestions
// Detects same-day, event-like clusters among the user's ungrouped sessions and
// returns them (deduped) so the sessions page can offer to group them into an
// Event project. Dismissed clusters are filtered out.
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, internal_case_id, recorded_at, created_at, duration_sec, input_hint, recording_type, case_id, status')
      .eq('user_id', user.id)
      .is('case_id', null)
      .in('status', ['done'])
      .not('recorded_at', 'is', null)

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 })
    }

    const rows = sessions || []
    if (rows.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    // Pull original filenames for dedup (same physical recording uploaded twice).
    const sessionIds = rows.map((s: any) => s.id)
    const { data: files } = await supabase
      .from('files')
      .select('session_id, original_filename')
      .in('session_id', sessionIds)

    const filenameBySession = new Map<string, string>()
    for (const f of files || []) {
      const sid = (f as any).session_id as string
      const name = ((f as any).original_filename as string | null) || ''
      // Keep the first non-empty filename per session.
      if (name && !filenameBySession.has(sid)) filenameBySession.set(sid, name)
    }

    const clusterable: ClusterableSession[] = rows.map((s: any) => ({
      id: s.id,
      internal_case_id: s.internal_case_id ?? null,
      recorded_at: s.recorded_at ?? null,
      created_at: s.created_at,
      duration_sec: s.duration_sec ?? null,
      input_hint: s.input_hint ?? null,
      recording_type: s.recording_type ?? null,
      original_filename: filenameBySession.get(s.id) ?? null,
    }))

    const clusters = clusterSessions(clusterable)

    // Filter out clusters the user already dismissed.
    const { data: dismissed } = await supabase
      .from('dismissed_event_suggestions')
      .select('signature')
      .eq('user_id', user.id)
    const dismissedSet = new Set((dismissed || []).map((d: any) => d.signature as string))

    const suggestions = clusters
      .filter((c: EventCluster) => !dismissedSet.has(c.signature))
      .map((c) => ({
        signature: c.signature,
        date: c.date,
        count: c.count,
        duplicateCount: c.duplicateSessionIds.length,
        sessionIds: c.sessionIds,
        sampleTitles: c.sampleTitles,
      }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/events/suggestions
//   { action: 'dismiss', signature }                       -> remember dismissal
//   { action: 'accept', signature, sessionIds, title? }    -> create Event project,
//                                                              attach the given (deduped) sessions
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    const action = String(body?.action || '')

    if (action === 'dismiss') {
      const signature = String(body?.signature || '').trim()
      if (!signature) {
        return NextResponse.json({ error: 'signature is required' }, { status: 400 })
      }
      const { error } = await supabase
        .from('dismissed_event_suggestions')
        .upsert(
          { user_id: user.id, signature },
          { onConflict: 'user_id,signature', ignoreDuplicates: true }
        )
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'accept') {
      const sessionIds: string[] = Array.isArray(body?.sessionIds)
        ? body.sessionIds.filter((x: unknown) => typeof x === 'string')
        : []
      if (sessionIds.length === 0) {
        return NextResponse.json({ error: 'sessionIds is required' }, { status: 400 })
      }
      const title =
        typeof body?.title === 'string' && body.title.trim()
          ? body.title.trim()
          : `Event · ${String(body?.date || '').trim() || new Date().toISOString().slice(0, 10)}`

      const { data: newCase, error: caseError } = await supabase
        .from('cases')
        .insert({
          user_id: user.id,
          title,
          client_identifier: '',
          description: '',
          status: 'active',
          project_type: 'Event',
        })
        .select()
        .single()

      if (caseError || !newCase) {
        return NextResponse.json({ error: caseError?.message || 'Failed to create project' }, { status: 500 })
      }

      // Attach only the user's own ungrouped sessions from the proposed set.
      const { error: attachError } = await supabase
        .from('sessions')
        .update({ case_id: newCase.id })
        .eq('user_id', user.id)
        .is('case_id', null)
        .in('id', sessionIds)

      if (attachError) {
        return NextResponse.json({ error: attachError.message }, { status: 500 })
      }

      // Remember the signature so the suggestion does not reappear.
      const signature = String(body?.signature || '').trim()
      if (signature) {
        await supabase
          .from('dismissed_event_suggestions')
          .upsert(
            { user_id: user.id, signature },
            { onConflict: 'user_id,signature', ignoreDuplicates: true }
          )
      }

      return NextResponse.json({ success: true, caseId: newCase.id })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
