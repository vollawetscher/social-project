import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createAISupportService } from '@/lib/services/ai-support'

// POST /api/support/analyze - Analyze errors for a case or session
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = createClient()
    const body = await request.json()

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    const { caseId, sessionId, type = 'case' } = body

    if (!caseId && !sessionId) {
      return NextResponse.json(
        { error: 'Either caseId or sessionId is required' },
        { status: 400 }
      )
    }

    // Verify ownership if not admin
    if (!isAdmin) {
      if (caseId) {
        const { data: caseData } = await supabase
          .from('cases')
          .select('user_id')
          .eq('id', caseId)
          .single()

        if (!caseData || caseData.user_id !== user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
      } else if (sessionId) {
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('user_id')
          .eq('id', sessionId)
          .single()

        if (!sessionData || sessionData.user_id !== user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
      }
    }

    // Perform AI analysis
    const aiSupport = createAISupportService(supabase)

    let analysis
    if (type === 'session' && sessionId) {
      analysis = await aiSupport.analyzeSessionErrors(sessionId)
    } else if (caseId) {
      analysis = await aiSupport.analyzeCaseErrors(caseId)
    } else {
      return NextResponse.json(
        { error: 'Invalid analysis type' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      analysis,
      isAdmin,
    })
  } catch (error) {
    console.error('[Support Analyze API] Failed to analyze errors:', error)

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
