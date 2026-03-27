import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { toV0Sessions } from '@/lib/adapters/session-adapter'
import { logError } from '@/lib/services/error-logger'
import { enqueuePulseUpdate } from '@/lib/services/pulse/enqueue-pulse-update'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')
    const adminView = searchParams.get('adminView') === 'true'

    let sessions: any[] | null
    let ownerEmails: Record<string, string> = {}

    if (adminView) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }

      const adminSupabase = createServiceRoleClient()
      const { data: adminSessions, error: adminError } = await adminSupabase
        .from('sessions')
        .select(`
          *,
          outputs:outputs(count),
          files:files(size_bytes,mime_type,original_filename,file_purpose),
          case:cases(id,title)
        `)
        .order('created_at', { ascending: false })

      if (adminError) {
        console.error('Database error (admin):', adminError)
        return NextResponse.json({ error: adminError.message, details: adminError }, { status: 500 })
      }

      sessions = adminSessions

      const userIds = Array.from(new Set((sessions || []).map((s: any) => s.user_id).filter(Boolean)))
      if (userIds.length > 0) {
        const { data: profiles } = await adminSupabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)
        ownerEmails = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.email || '—'
          return acc
        }, {})
      }
    } else {
      // Find sessions where the user is the callee (claimed a forked session)
      const { data: calleeLinks } = await supabase
        .from('calls')
        .select('callee_session_id')
        .eq('callee_user_id', user.id)
        .not('callee_session_id', 'is', null)

      const calleeSessionIds = (calleeLinks || [])
        .map((c: any) => c.callee_session_id)
        .filter(Boolean) as string[]

      const runUserSessionsQuery = async (excludeMerged: boolean) => {
        let query = supabase
          .from('sessions')
          .select('*, outputs:outputs(count), files:files(size_bytes,mime_type,original_filename,file_purpose), case:cases(id,title)')
          .order('created_at', { ascending: false })

        if (excludeMerged) {
          query = query.is('merged_into_session_id', null)
        }

        if (calleeSessionIds.length > 0) {
          query = query.or(`user_id.eq.${user.id},id.in.(${calleeSessionIds.join(',')})`)
        } else {
          query = query.eq('user_id', user.id)
        }

        return query
      }

      let { data, error } = await runUserSessionsQuery(true)

      // Backward-compatible fallback for environments where the merge-tracking
      // migration has not been applied yet.
      if (error && /merged_into_session_id|column .* does not exist/i.test(error.message || '')) {
        console.warn('sessions.merge_filter_unavailable; retrying without merged filter')
        const fallback = await runUserSessionsQuery(false)
        data = fallback.data
        error = fallback.error
      }

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ error: error.message, details: error }, { status: 500 })
      }

      // Tag callee sessions so the UI can show a "From a call" badge
      const calleeSessionIdSet = new Set(calleeSessionIds)
      sessions = (data || []).map((s: any) => ({
        ...s,
        is_from_call: calleeSessionIdSet.has(s.id),
      }))
    }

    const sessionIds = (sessions || []).map((s: any) => s.id).filter(Boolean) as string[]
    const callDurationBySessionId: Record<string, number> = {}
    if (sessionIds.length > 0) {
      const durationDb = adminView ? createServiceRoleClient() : supabase
      const { data: linkedCalls } = await durationDb
        .from('calls')
        .select('session_id, callee_session_id, started_at, ended_at')
        .or([
          `session_id.in.(${sessionIds.join(',')})`,
          `callee_session_id.in.(${sessionIds.join(',')})`,
        ].join(','))

      for (const call of linkedCalls || []) {
        const startedAtMs = call.started_at ? new Date(call.started_at).getTime() : 0
        const endedAtMs = call.ended_at ? new Date(call.ended_at).getTime() : 0
        if (!(startedAtMs > 0 && endedAtMs > startedAtMs)) continue
        const durationSec = Math.round((endedAtMs - startedAtMs) / 1000)
        const primarySessionId = typeof call.session_id === 'string' ? call.session_id : null
        const calleeSessionId = typeof call.callee_session_id === 'string' ? call.callee_session_id : null
        if (primarySessionId) callDurationBySessionId[primarySessionId] = durationSec
        if (calleeSessionId) callDurationBySessionId[calleeSessionId] = durationSec
      }
    }

    const sessionsWithCount = sessions?.map((session: any) => {
      const outputCount = session.outputs?.[0]?.count || 0
      const files = Array.isArray(session.files) ? session.files : []
      const totalSizeBytes = files.reduce((acc: number, f: any) => acc + (Number(f?.size_bytes) || 0), 0)
      const textUploadSizeBytes = files
        .filter((f: any) => {
          const mime = String(f?.mime_type || '').toLowerCase()
          const filename = String(f?.original_filename || '').toLowerCase()
          return (
            mime.startsWith('text/') ||
            mime.includes('subrip') ||
            mime.includes('vtt') ||
            filename.endsWith('.txt') ||
            filename.endsWith('.srt') ||
            filename.endsWith('.vtt')
          )
        })
        .reduce((acc: number, f: any) => acc + (Number(f?.size_bytes) || 0), 0)

      const hasAudioFile = files.some((f: any) => {
        const mime = String(f?.mime_type || '').toLowerCase()
        const filename = String(f?.original_filename || '').toLowerCase()
        const audioLikeByExtension = /\.(mp3|wav|m4a|m4v|mp4|ogg|aac|flac|weba|webm|amr|mpeg)$/i.test(filename)
        return mime.startsWith('audio/') || mime.startsWith('video/') || audioLikeByExtension
      })

      const { outputs, files: _files, ...rest } = session
      const normalizedDurationSec =
        typeof rest.duration_sec === 'number' && rest.duration_sec > 0
          ? (
              callDurationBySessionId[rest.id] && callDurationBySessionId[rest.id] > 0
                ? Math.min(rest.duration_sec, callDurationBySessionId[rest.id])
                : rest.duration_sec
            )
          : rest.duration_sec
      const out = {
        ...rest,
        duration_sec: normalizedDurationSec,
        output_count: outputCount,
        upload_size_bytes: totalSizeBytes,
        text_upload_size_bytes: textUploadSizeBytes,
        has_audio_file: hasAudioFile,
      }
      if (adminView && session.user_id && ownerEmails[session.user_id]) {
        (out as any).owner_email = ownerEmails[session.user_id]
      }
      return out
    }) || []

    if (format === 'v0' && sessionsWithCount.length > 0) {
      return NextResponse.json(toV0Sessions(sessionsWithCount))
    }

    return NextResponse.json(sessionsWithCount)
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()
    const { context_note = '', internal_case_id = '', case_id = null, language, input_hint, user_is_speaker } = body

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        case_id,
        context_note,
        internal_case_id,
        status: 'created',
        ...(language && { language }),
        ...(input_hint && { input_hint }),
        ...(user_is_speaker != null && { user_is_speaker }),
      })
      .select()
      .single()

    if (error) {
      await logError({
        errorType: 'api_error',
        severity: 'error',
        message: `Failed to create session: ${error.message}`,
        userId: user.id,
        endpoint: '/api/sessions',
        method: 'POST',
        errorCode: error.code,
        metadata: { dbError: error },
      }).catch(() => {})
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (session?.id && session?.case_id) {
      enqueuePulseUpdate({
        caseId: String(session.case_id),
        sessionId: String(session.id),
        userId: user.id,
      }).catch((queueError) => {
        console.warn('[Sessions] Failed to enqueue pulse_update on create:', queueError)
      })
    }

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status >= 500) {
        await logError({
          errorType: 'server_error',
          severity: 'error',
          message: `Session creation failed: ${error.message}`,
          error,
          endpoint: '/api/sessions',
          method: 'POST',
        }).catch(() => {})
      }
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    await logError({
      errorType: 'server_error',
      severity: 'critical',
      message: `Session creation unknown error: ${String(error)}`,
      error,
      endpoint: '/api/sessions',
      method: 'POST',
    }).catch(() => {})
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
