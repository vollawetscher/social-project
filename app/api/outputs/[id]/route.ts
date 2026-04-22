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

    // Fetch output with session info.
    //
    // Access is enforced by RLS on `outputs`:
    //   - "Users can read outputs on accessible sessions"
    //     → owner + session_collaborators entries
    //   - "Admins can view all outputs"
    //   - "Anyone can view publicly shared outputs" (via share_token, used by
    //     the public /api/share/[token] endpoint with service role)
    //
    // Do NOT add a `.eq('created_by', user.id)` filter here — that broke the
    // "open shared session's output" flow for collaborators: the session
    // owner creates the output, so its created_by is the owner, and any
    // collaborator opening /outputs/<id> was getting 404 "Output not found"
    // even though RLS would have allowed them to read it.
    const { data: output, error } = await supabase
      .from('outputs')
      .select(`
        *,
        sessions!inner(id, internal_case_id),
        templates(name)
      `)
      .eq('id', params.id)
      .maybeSingle()

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
      templateName: output.templates?.name || output.template_name || 'Unknown Template',
      perspective: output.perspective || 'party_a',
      audience: output.audience || 'internal',
      language: output.language || 'en',
      tone: output.tone || 'neutral',
      format: output.format || 'markdown',
      content: output.content,
      createdAt: output.generated_at || output.created_at,
      transcriptVersionHash: output.transcript_version_hash || output.id.slice(0, 8),
      citeTimestamps: output.cite_timestamps !== false,
      // Sharing info
      isPublic: output.is_public || false,
      shareToken: output.share_token,
      viewCount: output.view_count || 0,
      sharedAt: output.shared_at,
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

export async function DELETE(
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

    // Delete output (only if user owns it)
    const { error } = await supabase
      .from('outputs')
      .delete()
      .eq('id', params.id)
      .eq('created_by', user.id)

    if (error) {
      console.error('Error deleting output:', error)
      return NextResponse.json({ 
        error: 'Failed to delete output',
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/outputs/[id]:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 })
  }
}
