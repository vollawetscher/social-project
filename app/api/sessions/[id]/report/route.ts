import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import { logError } from '@/lib/services/error-logger'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)
    const supabase = await createClient()

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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)
    
    // Use service role to delete report (bypass RLS)
    const supabase = createServiceRoleClient()

    // Delete the report
    const { error: deleteError } = await supabase
      .from('reports')
      .delete()
      .eq('session_id', params.id)

    if (deleteError) {
      console.error('[DeleteReport] Error:', deleteError)
      await logError({
        errorType: 'api_error',
        severity: 'error',
        message: 'Failed to delete report',
        error: deleteError,
        sessionId: params.id,
        userId: user.id,
        endpoint: '/api/sessions/[id]/report',
        method: 'DELETE',
      })
      return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
    }

    // Reset session status to 'done' so report can be regenerated
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ 
        status: 'done',
        last_error: null
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('[DeleteReport] Failed to update session status:', updateError)
    }

    return NextResponse.json({ success: true, message: 'Report deleted' })
  } catch (error) {
    if (error instanceof Error) {
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
            method: 'DELETE',
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
