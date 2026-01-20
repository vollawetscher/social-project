import { NextResponse } from 'next/server'
import { requireAuth, requireSessionOwnership, handleAuthError } from '@/lib/auth/helpers'
import { generateReport } from '@/lib/services/report-generator'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Summarize] Starting summarization for session:', params.id)
    const user = await requireAuth()
    await requireSessionOwnership(params.id, user.id)
    
    const supabase = createClient()
    const rohbericht = await generateReport(params.id, supabase)
    
    return NextResponse.json({ success: true, rohbericht })
  } catch (error: any) {
    console.error('[Summarize] CRITICAL ERROR - Exception caught:', error)
    console.error('[Summarize] Error message:', error.message)
    console.error('[Summarize] Error stack:', error.stack)

    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401 || authError.status === 403 || authError.status === 404) {
        return NextResponse.json({ error: authError.message }, { status: authError.status })
      }
    }

    const supabase = createClient()
    const errorMessage = error.message || 'Report generation failed'

    await supabase
      .from('sessions')
      .update({
        status: 'error',
        last_error: errorMessage
      })
      .eq('id', params.id)

    return NextResponse.json(
      { error: errorMessage, details: error.stack },
      { status: 500 }
    )
  }
}
