import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClaudeService } from '@/lib/services/claude'
import { requireAuth, requireSessionOwnership, handleAuthError } from '@/lib/auth/helpers'

/**
 * POST /api/sessions/[id]/improve-field
 * Improves/structures text in context_text, private_comments, or instructions fields
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionOwnership(params.id, user.id)
    const supabase = await createClient()

    const body = await request.json()
    const { fieldName, text } = body

    if (!fieldName || !['context_text', 'private_comments', 'instructions'].includes(fieldName)) {
      return NextResponse.json({ error: 'Invalid fieldName' }, { status: 400 })
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text to improve' }, { status: 400 })
    }

    // Get session for language preference
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('preferred_report_language')
      .eq('id', params.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Improve text with Claude
    const claudeService = createClaudeService()
    const language = (session as any).preferred_report_language || 'de'
    const improvedText = await claudeService.improveField(
      text,
      fieldName,
      language
    )

    return NextResponse.json({
      success: true,
      improved_text: improvedText
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
