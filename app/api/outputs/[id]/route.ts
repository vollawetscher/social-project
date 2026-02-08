import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch output with session info
    const { data: output, error } = await supabase
      .from('outputs')
      .select(`
        *,
        sessions!inner(id, internal_case_id),
        templates(name)
      `)
      .eq('id', params.id)
      .eq('created_by', user.id)
      .single()

    if (error) {
      console.error('Error fetching output:', error)
      return NextResponse.json({ error: 'Output not found' }, { status: 404 })
    }

    if (!output) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 })
    }

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
      transcriptVersionHash: output.transcript_version_hash || output.id.slice(0, 8),
      citeTimestamps: output.cite_timestamps !== false,
    }

    return NextResponse.json(v0Output)
  } catch (error: any) {
    console.error('Error in GET /api/outputs/[id]:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 })
  }
}
