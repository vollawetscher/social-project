import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { toV0Sessions } from '@/lib/adapters/session-adapter'
import { logError } from '@/lib/services/error-logger'

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
          outputs:outputs(count)
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
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          outputs:outputs(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ error: error.message, details: error }, { status: 500 })
      }
      sessions = data
    }

    const sessionsWithCount = sessions?.map((session: any) => {
      const outputCount = session.outputs?.[0]?.count || 0
      const { outputs, ...rest } = session
      const out = { ...rest, output_count: outputCount }
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
    const { context_note = '', internal_case_id = '', case_id = null, language } = body

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        case_id,
        context_note,
        internal_case_id,
        status: 'created',
        ...(language && { language }),
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
