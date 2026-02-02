import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionOwnership, handleAuthError } from '@/lib/auth/helpers'
import { logError } from '@/lib/services/error-logger'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionOwnership(params.id, user.id)
    const supabase = createClient()

    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('session_id', params.id)
      .maybeSingle()

    if (error || !report) {
      // Log not found as potential issue
      if (error) {
        await logError({
          errorType: 'api_error',
          severity: 'warning',
          message: 'Report retrieval failed',
          error,
          sessionId: params.id,
          userId: user.id,
          endpoint: '/api/sessions/[id]/report',
          method: 'GET',
        })
      }
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json(report)
  } catch (error) {
    if (error instanceof Error) {
      // Log the error for tracking
      try {
        const user = await requireAuth().catch(() => null)
        if (user) {
          await logError({
            errorType: 'server_error',
            severity: 'error',
            message: error.message,
            error,
            sessionId: params.id,
            userId: user.id,
            endpoint: '/api/sessions/[id]/report',
            method: 'GET',
          })
        }
      } catch (logErr) {
        console.error('Failed to log error:', logErr)
      }

      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
