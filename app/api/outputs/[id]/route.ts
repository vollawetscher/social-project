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
        session:sessions(id, internal_case_id),
        template:templates(name)
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
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
      sessionFilename: output.session?.internal_case_id || `Session ${output.session_id.slice(0, 8)}`,
      templateId: output.template_id,
      templateName: output.template?.name || output.title || 'Unknown Template',
      perspective: 'party_a', // Default, could be stored in DB
      audience: 'internal', // Default, could be stored in DB
      language: 'en', // Default, could be stored in DB
      tone: 'neutral', // Default, could be stored in DB
      format: 'markdown',
      content: output.content,
      createdAt: output.generated_at || output.created_at,
      transcriptVersionHash: output.id.slice(0, 8), // Simplified
      citeTimestamps: true, // Default
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
