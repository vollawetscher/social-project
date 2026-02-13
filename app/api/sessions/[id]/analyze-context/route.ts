import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClaudeService } from '@/lib/services/claude'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'

/**
 * POST /api/sessions/[id]/analyze-context
 * Analyzes context_note with Claude and returns structured context
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionAccess(params.id, user.id)
    const supabase = await createClient()

    // Get session with context (prefer context_text, fallback to context_note)
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('context_text, context_note, preferred_report_language')
      .eq('id', params.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const contextToAnalyze = (session as any).context_text || session.context_note || ''
    
    if (!contextToAnalyze || contextToAnalyze.trim().length === 0) {
      return NextResponse.json({ error: 'No context to analyze' }, { status: 400 })
    }

    // Analyze context with Claude
    const claudeService = createClaudeService()
    const language = (session as any).preferred_report_language || 'de'
    const structuredContext = await claudeService.analyzeContext(
      contextToAnalyze,
      language
    )

    // Save structured context
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ structured_context: structuredContext })
      .eq('id', params.id)

    if (updateError) {
      console.error('Failed to save structured context:', updateError)
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      structured_context: structuredContext
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
