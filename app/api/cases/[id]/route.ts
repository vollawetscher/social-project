import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

// Helper function to check case ownership
async function requireCaseOwnership(caseId: string, userId: string) {
  const supabase = await createClient()
  const { data: caseData, error } = await supabase
    .from('cases')
    .select('user_id')
    .eq('id', caseId)
    .maybeSingle()

  if (error || !caseData) {
    throw new Error('Case not found')
  }

  if (caseData.user_id !== userId) {
    throw new Error('Unauthorized access to case')
  }
}

// GET /api/cases/[id] - Get case details with all sessions
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireCaseOwnership(params.id, user.id)
    const supabase = await createClient()

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', params.id)
      .single()

    if (caseError) {
      return NextResponse.json({ error: caseError.message }, { status: 404 })
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('case_id', params.id)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 })
    }

    return NextResponse.json({ ...caseData, sessions: sessions || [] })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/cases/[id]
// Supports named actions via body.action:
//   action: 'archive'           — archive project, stamp retention_days from user profile
//   action: 'restore'           — restore to active, clear archived_at + scheduled_deletion_at
//   action: 'extend', days: N   — add N days to retention_days (re-stamps scheduled_deletion_at)
//   (no action)                 — generic field update (title, description, status, etc.)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireCaseOwnership(params.id, user.id)
    const supabase = await createClient()
    const body = await request.json()

    const { action, days, ...fields } = body

    let updatePayload: Record<string, any>

    if (action === 'archive') {
      // Fetch the user's default retention period
      const { data: profile } = await supabase
        .from('profiles')
        .select('default_retention_days')
        .eq('id', user.id)
        .single()

      const retentionDays = profile?.default_retention_days ?? 90
      updatePayload = {
        status: 'archived',
        archived_at: new Date().toISOString(),
        retention_days: retentionDays,
        // scheduled_deletion_at is kept in sync by DB trigger
      }
    } else if (action === 'restore') {
      updatePayload = {
        status: 'active',
        archived_at: null,
        // trigger will null out scheduled_deletion_at automatically
      }
    } else if (action === 'extend') {
      const extraDays = Number(days) || 90
      // Increment retention_days; trigger recomputes scheduled_deletion_at
      const { data: current } = await supabase
        .from('cases')
        .select('retention_days')
        .eq('id', params.id)
        .single()
      updatePayload = {
        retention_days: (current?.retention_days ?? 90) + extraDays,
      }
    } else {
      // Generic field update — restrict to a known allowlist of editable fields.
      // Anything outside this set (e.g. user_id, pulse_*, retention_days) is
      // ignored to prevent accidental tampering via the generic path.
      const editableFields = [
        'title',
        'description',
        'client_identifier',
        'status',
        'project_type',
        'user_role',
        'default_session_purpose',
      ] as const
      updatePayload = {}
      for (const key of editableFields) {
        if (Object.prototype.hasOwnProperty.call(fields, key)) {
          const raw = (fields as Record<string, unknown>)[key]
          if (key === 'project_type' || key === 'user_role' || key === 'default_session_purpose') {
            const trimmed = typeof raw === 'string' ? raw.trim() : ''
            updatePayload[key] = trimmed || null
          } else if (typeof raw === 'string') {
            updatePayload[key] = raw
          } else if (raw === null) {
            updatePayload[key] = null
          }
        }
      }

      // event_metadata is a JSON object (confirmed web-enriched event identity),
      // handled separately from the string allowlist above.
      if (Object.prototype.hasOwnProperty.call(fields, 'event_metadata')) {
        const raw = (fields as Record<string, unknown>).event_metadata
        if (raw === null) {
          updatePayload.event_metadata = null
        } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          updatePayload.event_metadata = raw
        }
      }

      if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
      }
    }

    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update(updatePayload)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(updatedCase)
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/cases/[id]
// Query param: mode=keep_sessions (default) | mode=delete_all
//   keep_sessions — unlinks all sessions (sets case_id=null), then deletes the project
//   delete_all    — deletes sessions + audio + outputs, then deletes the project
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireCaseOwnership(params.id, user.id)
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') ?? 'keep_sessions'

    if (mode === 'keep_sessions') {
      // Unlink all sessions from this project
      await supabase
        .from('sessions')
        .update({ case_id: null })
        .eq('case_id', params.id)

      // Delete the project record
      const { error } = await supabase.from('cases').delete().eq('id', params.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ success: true, mode: 'keep_sessions' })
    }

    // mode === 'delete_all': delete audio files first, then cascade via DB
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('case_id', params.id)

    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        const { data: files } = await supabase
          .from('files')
          .select('storage_path')
          .eq('session_id', session.id)

        if (files && files.length > 0) {
          const paths = files.map((f: any) => f.storage_path).filter(Boolean)
          if (paths.length > 0) {
            await supabase.storage.from('rohbericht-audio').remove(paths)
          }
        }
      }
    }

    // Delete the project (sessions cascade via FK ON DELETE CASCADE)
    const { error } = await supabase.from('cases').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, mode: 'delete_all' })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
