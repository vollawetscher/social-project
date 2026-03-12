import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createErrorLogger, ErrorContext } from '@/lib/services/error-logger'

// PATCH /api/error-logs - Resolve/update an error log (admin only)
export async function PATCH(request: Request) {
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

    const body = await request.json()
    const { id, resolved, resolution_notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Error log ID required' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (typeof resolved === 'boolean') {
      updateData.resolved = resolved
      if (resolved) {
        updateData.resolved_at = new Date().toISOString()
      } else {
        updateData.resolved_at = null
      }
    }
    if (typeof resolution_notes === 'string') {
      updateData.resolution_notes = resolution_notes
    }

    const { error } = await supabase
      .from('error_logs')
      .update(updateData)
      .eq('id', id)

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

// POST /api/error-logs - Submit an error log (client-side or server-side)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const logger = await createErrorLogger(supabase)

    const body = await request.json()

    // Validate required fields
    if (!body.message || !body.errorType) {
      return NextResponse.json(
        { error: 'Missing required fields: message and errorType' },
        { status: 400 }
      )
    }

    const ownerEmail = user.email || null
    const metadataWithOwner = {
      ...(body.metadata || {}),
      owner_email: ownerEmail,
    }

    // Create error context
    const errorContext: ErrorContext = {
      caseId: body.caseId || null,
      sessionId: body.sessionId || null,
      fileId: body.fileId || null,
      userId: user.id,
      errorType: body.errorType,
      severity: body.severity || 'error',
      message: body.message,
      errorCode: body.errorCode,
      endpoint: body.metadata?.pathname || new URL(request.url).pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: metadataWithOwner,
      userDescription: body.userDescription,
      reproductionSteps: body.reproductionSteps,
    }

    const result = await logger.log(errorContext)

    if (result.error) {
      return NextResponse.json(
        { error: 'Failed to log error' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: result.id,
      message: 'Error logged successfully',
    })
  } catch (error) {
    console.error('[ErrorLogs API] Failed to log error:', error)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/error-logs - Get error logs (admin only or user's own errors)
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('caseId')
    const sessionId = searchParams.get('sessionId')
    const errorType = searchParams.get('errorType')
    const severity = searchParams.get('severity')
    const resolved = searchParams.get('resolved')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build query
    let query = supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    // Non-admin users can only see their own errors
    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    // Apply filters
    if (caseId) {
      query = query.eq('case_id', caseId)
    }

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    if (errorType) {
      query = query.eq('error_type', errorType)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (resolved !== null) {
      query = query.eq('resolved', resolved === 'true')
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    let errorsWithOwnerEmail = data || []

    // For admin view, attach owner email to each bug/error row.
    if (isAdmin && data && data.length > 0) {
      const userIds = Array.from(
        new Set(
          data
            .map((row) => row.user_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        )
      )

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)

        const emailByUserId = new Map((profiles || []).map((p) => [p.id, p.email || null]))

        errorsWithOwnerEmail = data.map((row) => ({
          ...row,
          owner_email:
            (row.user_id ? emailByUserId.get(row.user_id) || null : null) ||
            (row.metadata && typeof row.metadata === 'object'
              ? (row.metadata as Record<string, unknown>).owner_email as string | null
              : null),
        }))
      }
    }

    return NextResponse.json({
      errors: errorsWithOwnerEmail,
      isAdmin,
    })
  } catch (error) {
    console.error('[ErrorLogs API] Failed to fetch errors:', error)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
