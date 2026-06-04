import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { enrichEvent } from '@/lib/services/event/event-enrichment'
import type { EventSessionRow } from '@/lib/services/event/event-signals'

// POST /api/cases/[id]/enrich-event
// Resolves the event's public identity (name, venue, dates, speaker roster)
// from the project's session signals. Returns a proposal for the user to
// confirm — does NOT persist. Confirmation is a PATCH to /api/cases/[id] with
// { event_metadata: { ...proposal, confirmed: true } }.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id, user_id, title')
      .eq('id', params.id)
      .maybeSingle()

    if (caseError || !caseRow) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (caseRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, internal_case_id, recorded_at, created_at, duration_sec, input_hint, recording_type, language, speechmatics_summary, purpose, ai_extracted_context')
      .eq('case_id', params.id)

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 })
    }

    const rows: EventSessionRow[] = (sessions || []).map((s: any) => ({
      id: s.id,
      internal_case_id: s.internal_case_id ?? null,
      recorded_at: s.recorded_at ?? null,
      created_at: s.created_at,
      duration_sec: s.duration_sec ?? null,
      input_hint: s.input_hint ?? null,
      recording_type: s.recording_type ?? null,
      original_filename: null,
      language: s.language ?? null,
      speechmatics_summary: s.speechmatics_summary ?? null,
      purpose: s.purpose ?? null,
      ai_extracted_context: (s.ai_extracted_context as Record<string, any> | null) ?? null,
    }))

    if (rows.length === 0) {
      return NextResponse.json({ error: 'This project has no sessions to identify from.' }, { status: 400 })
    }

    const proposal = await enrichEvent(rows, { projectTitle: caseRow.title ?? null })
    return NextResponse.json({ proposal })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status !== 500) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
