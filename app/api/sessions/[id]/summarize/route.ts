import { NextResponse } from 'next/server'
import { requireAuth, requireSessionOwnership, handleAuthError } from '@/lib/auth/helpers'
import { generateReport } from '@/lib/services/report-generator'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Background job processor - runs independently of HTTP request
async function processReportGenerationJob(
  sessionId: string, 
  options?: { recordingIds?: string[]; language?: string }
) {
  // Use service role client to bypass RLS in background job
  const supabase = createServiceRoleClient()
  
  try {
    console.log('[Summarize] Starting report generation for session:', sessionId)
    if (options?.recordingIds) {
      console.log('[Summarize] Selected recordings:', options.recordingIds.length)
    }
    if (options?.language) {
      console.log('[Summarize] Preferred language:', options.language)
    }
    
    // Update status to summarizing
    await supabase
      .from('sessions')
      .update({ status: 'summarizing' })
      .eq('id', sessionId)
    
    // Update session with preferred report language if specified
    if (options?.language) {
      await supabase
        .from('sessions')
        .update({ preferred_report_language: options.language })
        .eq('id', sessionId)
    }
    
    await generateReport(sessionId, supabase, options)
    
    console.log('[Summarize] Report generation completed successfully!')
  } catch (error: any) {
    console.error('[Summarize] CRITICAL ERROR - Exception caught:', error)
    console.error('[Summarize] Error message:', error.message)
    console.error('[Summarize] Error stack:', error.stack)

    // Use service role client to update error status
    const supabase = createServiceRoleClient()
    const errorMessage = error.message || 'Report generation failed'

    await supabase
      .from('sessions')
      .update({
        status: 'error',
        last_error: errorMessage
      })
      .eq('id', sessionId)
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Summarize] Received request for session:', params.id)
    const user = await requireAuth()
    await requireSessionOwnership(params.id, user.id)
    
    // Parse optional request body
    let options: { recordingIds?: string[]; language?: string } | undefined
    try {
      const body = await request.json()
      options = {
        recordingIds: body.recordingIds,
        language: body.language,
      }
    } catch {
      // No body or invalid JSON - use defaults (all recordings, auto language)
      options = undefined
    }
    
    // Start background job (fire and forget)
    console.log('[Summarize] Starting background job for session:', params.id)
    processReportGenerationJob(params.id, options).catch(err => {
      console.error('[Summarize] Background job failed:', err)
    })
    
    // Return immediately with 202 Accepted
    return NextResponse.json(
      { 
        success: true, 
        message: 'Report generation job started',
        status: 'summarizing'
      },
      { status: 202 }
    )
  } catch (error: any) {
    console.error('[Summarize] Failed to start job:', error)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401 || authError.status === 403 || authError.status === 404) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to start report generation' },
      { status: 500 }
    )
  }
}
