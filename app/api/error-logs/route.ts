import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createErrorLogger, ErrorContext } from '@/lib/services/error-logger'

// POST /api/error-logs - Submit an error log (client-side or server-side)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = createClient()
    const logger = createErrorLogger(supabase)

    const body = await request.json()

    // Validate required fields
    if (!body.message || !body.errorType) {
      return NextResponse.json(
        { error: 'Missing required fields: message and errorType' },
        { status: 400 }
      )
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
      metadata: body.metadata || {},
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
    const supabase = createClient()

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

    return NextResponse.json({
      errors: data,
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
