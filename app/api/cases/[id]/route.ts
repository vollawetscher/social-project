import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

// Helper function to check case ownership
async function requireCaseOwnership(caseId: string, userId: string) {
  const supabase = createClient()
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
    const supabase = createClient()

    // Get case details
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', params.id)
      .single()

    if (caseError) {
      return NextResponse.json({ error: caseError.message }, { status: 404 })
    }

    // Get all sessions for this case
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('case_id', params.id)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 })
    }

    return NextResponse.json({
      ...caseData,
      sessions: sessions || []
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/cases/[id] - Update case
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireCaseOwnership(params.id, user.id)
    const supabase = createClient()
    const body = await request.json()

    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update(body)
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

// DELETE /api/cases/[id] - Delete case (and all associated sessions)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireCaseOwnership(params.id, user.id)
    const supabase = createClient()

    // Get all sessions for this case to delete their audio files
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('case_id', params.id)

    // Delete audio files for each session
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        const { data: files } = await supabase
          .from('files')
          .select('storage_path')
          .eq('session_id', session.id)

        if (files && files.length > 0) {
          const paths = files.map((f) => f.storage_path)
          await supabase.storage.from('rohbericht-audio').remove(paths)
        }
      }
    }

    // Delete the case (sessions will cascade delete)
    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
