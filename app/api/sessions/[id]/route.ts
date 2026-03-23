import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { enqueuePulseUpdate, shouldEnqueuePulseForCaseChange } from '@/lib/services/pulse/enqueue-pulse-update'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)

    // requireSessionAccess already verified access. Use service role so admins
    // can read sessions belonging to other users regardless of RLS policy state.
    const db = createServiceRoleClient()

    const { data: session, error } = await db
      .from('sessions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Also fetch files for this session
    const { data: files } = await db
      .from('files')
      .select('*')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    // Generate signed URLs for audio files (1-hour expiry) so the client can play them
    let filesWithUrls: any[] = files || []
    if (filesWithUrls.length > 0) {
      const paths = filesWithUrls.map((f: any) => f.storage_path).filter(Boolean)
      if (paths.length > 0) {
        const { data: signedUrls } = await db.storage
          .from('rohbericht-audio')
          .createSignedUrls(paths, 3600)

        if (signedUrls) {
          filesWithUrls = filesWithUrls.map((f: any) => {
            const match = signedUrls.find((s) => s.path === f.storage_path)
            return { ...f, signed_url: match?.signedUrl ?? null }
          })
        }
      }
    }

    // Fetch in-call consent logs if this session is linked to a call
    let consentLogs: any[] = []
    let linkedCallDurationSec: number | null = null
    const { data: linkedCall } = await db
      .from('calls')
      .select('id, started_at, ended_at')
      .or(`session_id.eq.${params.id},callee_session_id.eq.${params.id}`)
      .maybeSingle()

    if (linkedCall?.id) {
      const startedAtMs = linkedCall.started_at ? new Date(linkedCall.started_at).getTime() : 0
      const endedAtMs = linkedCall.ended_at ? new Date(linkedCall.ended_at).getTime() : 0
      if (startedAtMs > 0 && endedAtMs > startedAtMs) {
        linkedCallDurationSec = Math.round((endedAtMs - startedAtMs) / 1000)
      }

      const { data: consents } = await db
        .from('consent_logs')
        .select('participant_name, participant_identity, granted, created_at')
        .eq('call_id', linkedCall.id)
        .order('created_at', { ascending: true })
      consentLogs = consents || []
    }

    const normalizedDurationSec =
      typeof session.duration_sec === 'number' && session.duration_sec > 0
        ? (
            linkedCallDurationSec && linkedCallDurationSec > 0
              ? Math.min(session.duration_sec, linkedCallDurationSec)
              : session.duration_sec
          )
        : session.duration_sec

    return NextResponse.json({
      ...session,
      duration_sec: normalizedDurationSec,
      files: filesWithUrls,
      consent_logs: consentLogs,
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
    await requireSessionAccess(params.id, user.id)
    const supabase = await createClient()
    const body = await request.json()
    const hasCaseIdPatch = Object.prototype.hasOwnProperty.call(body || {}, 'case_id')

    let previousSession: { case_id: string | null; user_id: string } | null = null
    if (hasCaseIdPatch) {
      const { data } = await createServiceRoleClient()
        .from('sessions')
        .select('case_id, user_id')
        .eq('id', params.id)
        .maybeSingle()
      previousSession = (data as any) || null
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (hasCaseIdPatch && previousSession) {
      const prevCaseId = previousSession.case_id
      const nextCaseId = session?.case_id || null
      const shouldEnqueuePulse = shouldEnqueuePulseForCaseChange(prevCaseId, nextCaseId)

      if (shouldEnqueuePulse) {
        enqueuePulseUpdate({
          caseId: String(nextCaseId),
          sessionId: String(session.id),
          userId: String(previousSession.user_id || user.id),
        }).catch((queueError) => {
          console.warn('[Session PATCH] Failed to enqueue pulse_update:', queueError)
        })
      }
    }

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)

    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    const db = isAdmin ? createServiceRoleClient() : supabase
    const serviceDb = createServiceRoleClient()

    // Block deletion if a callee session is still waiting for the transcript.
    // Exception: if source session already failed, allow deletion and mark the
    // callee pending session as failed too (so it doesn't remain stuck forever).
    const { data: pendingCalleeCall } = await serviceDb
      .from('calls')
      .select('callee_session_id')
      .eq('session_id', params.id)
      .not('callee_session_id', 'is', null)
      .maybeSingle()

    if (pendingCalleeCall?.callee_session_id) {
      const { data: calleeSession } = await serviceDb
        .from('sessions')
        .select('is_callee_pending')
        .eq('id', pendingCalleeCall.callee_session_id)
        .maybeSingle()

      if (calleeSession?.is_callee_pending) {
        const { data: sourceSession } = await serviceDb
          .from('sessions')
          .select('status, last_error')
          .eq('id', params.id)
          .maybeSingle()

        const sourceFailed = sourceSession?.status === 'error'

        if (!sourceFailed) {
          return NextResponse.json(
            { error: 'This session is shared with another user whose transcript is still being prepared. Please try again later.' },
            { status: 409 }
          )
        }

        // Source already failed (e.g. no audio). Resolve callee pending state
        // before deleting source to avoid a permanently "transcribing" session.
        await serviceDb
          .from('sessions')
          .update({
            is_callee_pending: false,
            status: 'error',
            last_error: sourceSession?.last_error || 'Source session failed before transcript was available',
          })
          .eq('id', pendingCalleeCall.callee_session_id)
      }
    }

    const { data: files } = await db
      .from('files')
      .select('storage_path')
      .eq('session_id', params.id)

    if (files && files.length > 0) {
      const paths = files.map((f) => f.storage_path)

      // Don't delete audio from storage if a callee session shares the same files.
      const { data: sharedFiles } = await serviceDb
        .from('files')
        .select('storage_path')
        .in('storage_path', paths)
        .neq('session_id', params.id)

      const sharedPaths = new Set((sharedFiles || []).map((f: any) => f.storage_path))
      const pathsToDelete = paths.filter(p => !sharedPaths.has(p))

      if (pathsToDelete.length > 0) {
        await db.storage.from('rohbericht-audio').remove(pathsToDelete)
      }
    }

    const { data: deleted, error } = await db
      .from('sessions')
      .delete()
      .eq('id', params.id)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Session not found or could not be deleted' }, { status: 404 })
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
