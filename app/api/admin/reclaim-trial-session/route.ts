import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

/**
 * POST /api/admin/reclaim-trial-session
 *
 * One-off reversal for sessions that were previously handed off via the old
 * "Prepare Trial" behaviour (ownership rewritten to the client). Admin moves
 * the session back to themselves and, optionally, keeps the previous owner as
 * a collaborator so the trial view is preserved.
 *
 * Body: { sessionIds: string[], keepAsCollaborator?: boolean }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const sessionIds = Array.isArray(body.sessionIds)
      ? body.sessionIds.filter((v: unknown) => typeof v === 'string')
      : []
    const keepAsCollaborator = body.keepAsCollaborator !== false

    if (sessionIds.length === 0) {
      return NextResponse.json({ error: 'sessionIds required' }, { status: 400 })
    }

    const svc = createServiceRoleClient()

    const { data: beforeRows, error: fetchError } = await svc
      .from('sessions')
      .select('id, user_id')
      .in('id', sessionIds)

    if (fetchError) {
      console.error('[ReclaimTrial] Fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 })
    }

    const targets = (beforeRows || []).filter((s: any) => s.user_id !== user.id)

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        reclaimed: 0,
        message: 'No sessions to reclaim (already owned by you)',
      })
    }

    const targetIds = targets.map((s: any) => s.id)
    const previousOwners: Record<string, string> = {}
    for (const s of targets as Array<{ id: string; user_id: string }>) {
      previousOwners[s.id] = s.user_id
    }

    const { error: updateError } = await svc
      .from('sessions')
      .update({ user_id: user.id })
      .in('id', targetIds)

    if (updateError) {
      console.error('[ReclaimTrial] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to reclaim sessions' }, { status: 500 })
    }

    let collaboratorsCreated = 0
    if (keepAsCollaborator) {
      const rows = targetIds
        .map((id) => {
          const prevOwner = previousOwners[id]
          if (!prevOwner) return null
          return {
            session_id: id,
            user_id: prevOwner,
            role: 'collaborator',
            added_by: user.id,
            source: 'trial',
          }
        })
        .filter(Boolean) as Array<Record<string, unknown>>

      if (rows.length > 0) {
        const { error: shareError } = await svc
          .from('session_collaborators')
          .upsert(rows, { onConflict: 'session_id,user_id', ignoreDuplicates: false })
        if (shareError) {
          console.error('[ReclaimTrial] Share restore error:', shareError)
          // Non-fatal; ownership has already been reclaimed
        } else {
          collaboratorsCreated = rows.length
        }
      }
    }

    return NextResponse.json({
      success: true,
      reclaimed: targetIds.length,
      collaboratorsCreated,
      sessionIds: targetIds,
    })
  } catch (error) {
    if (error instanceof Error) {
      const authErr = handleAuthError(error)
      return NextResponse.json({ error: authErr.message }, { status: authErr.status })
    }
    console.error('[ReclaimTrial] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
