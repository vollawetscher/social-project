import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Output } from '@/lib/types-v0'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: output, error } = await supabase
      .from('outputs')
      .select(`
        *,
        sessions!inner(internal_case_id)
      `)
      .eq('id', params.id)
      .eq('created_by', user.id)
      .single()

    if (error || !output) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 })
    }

    // Transform to v0 format
    const formattedOutput: Output = {
      id: output.id,
      sessionId: output.session_id,
      sessionFilename: output.sessions?.internal_case_id || 'Unknown',
      templateId: output.template_id || '',
      templateName: output.template_name,
      perspective: output.perspective,
      audience: output.audience,
      language: output.language,
      tone: output.tone,
      format: output.format,
      content: output.content,
      createdAt: output.created_at,
      transcriptVersionHash: output.transcript_version_hash || '',
      citeTimestamps: output.cite_timestamps || false,
    }

    return NextResponse.json(formattedOutput)
  } catch (error) {
    console.error('Error fetching output:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('outputs')
      .delete()
      .eq('id', params.id)
      .eq('created_by', user.id)

    if (error) {
      return NextResponse.json({ error: 'Output not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting output:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
