import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Get shared output by token (public access, no auth required)
export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = await createClient()

    // Fetch output by share token (no user filter - public access)
    const { data: output, error } = await supabase
      .from('outputs')
      .select(`
        *,
        sessions!inner(id, internal_case_id, user_id),
        templates(name),
        profiles!outputs_created_by_fkey(full_name, company_name)
      `)
      .eq('share_token', params.token)
      .eq('is_public', true)
      .single()

    if (error || !output) {
      console.error('Error fetching shared output:', error)
      return NextResponse.json({ error: 'Shared output not found or no longer available' }, { status: 404 })
    }

    // Increment view count (non-blocking)
    supabase
      .from('outputs')
      .update({ view_count: (output.view_count || 0) + 1 })
      .eq('id', output.id)
      .then(() => {
        console.log(`[Share] Incremented view count for output ${output.id}`)
      })
      .catch((err: any) => {
        console.error('[Share] Failed to increment view count:', err)
      })

    // Transform to v0 format
    const v0Output = {
      id: output.id,
      sessionId: output.session_id,
      sessionFilename: output.sessions?.internal_case_id || `Session ${output.session_id.slice(0, 8)}`,
      templateId: output.template_id,
      templateName: output.templates?.name || output.title || 'Unknown Template',
      perspective: output.perspective || 'party_a',
      audience: output.audience || 'internal',
      language: output.language || 'en',
      tone: output.tone || 'neutral',
      format: output.format || 'markdown',
      content: output.content,
      createdAt: output.generated_at || output.created_at,
      sharedBy: output.profiles?.full_name || output.profiles?.company_name || 'Notissima User',
      viewCount: (output.view_count || 0) + 1, // Include the current view
      sharedAt: output.shared_at,
    }

    return NextResponse.json(v0Output)
  } catch (error: any) {
    console.error('Error in GET /api/share/[token]:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 })
  }
}
