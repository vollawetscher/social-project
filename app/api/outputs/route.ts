import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Output } from '@/lib/types-v0'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    let isAdmin = false
    if (sessionId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      isAdmin = profile?.role === 'admin'
    }

    let query = supabase
      .from('outputs')
      .select(`
        *,
        sessions!inner(internal_case_id)
      `)
      .order('created_at', { ascending: false })

    if (sessionId) {
      query = query.eq('session_id', sessionId)
      if (!isAdmin) {
        query = query.eq('created_by', user.id)
      }
    } else {
      query = query.eq('created_by', user.id)
    }

    const { data: outputs, error } = await query

    if (error) {
      console.error('Error fetching outputs:', error)
      return NextResponse.json({ error: 'Failed to fetch outputs' }, { status: 500 })
    }

    // Transform to v0 format
    const formattedOutputs: Output[] = (outputs || []).map((o: any) => ({
      id: o.id,
      sessionId: o.session_id,
      sessionFilename: o.sessions?.internal_case_id || 'Unknown',
      templateId: o.template_id || '',
      templateName: o.template_name,
      perspective: o.perspective,
      audience: o.audience,
      language: o.language,
      tone: o.tone,
      format: o.format,
      content: o.content,
      createdAt: o.created_at,
      transcriptVersionHash: o.transcript_version_hash || '',
      citeTimestamps: o.cite_timestamps || false,
      costUsd: o.cost_usd != null ? Number(o.cost_usd) : null,
    }))

    return NextResponse.json(formattedOutputs)
  } catch (error) {
    console.error('Unexpected error in outputs route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      sessionId, 
      templateId, 
      templateName,
      perspective, 
      audience, 
      language, 
      tone, 
      format, 
      content,
      transcriptVersionHash,
      citeTimestamps
    } = body

    // Validate required fields
    if (!sessionId || !templateName || !perspective || !audience || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      )
    }

    // Insert output
    const { data: output, error } = await supabase
      .from('outputs')
      .insert({
        session_id: sessionId,
        template_id: templateId || null,
        template_name: templateName,
        perspective,
        audience,
        language: language || 'en',
        tone: tone || 'formal',
        format: format || 'report',
        content,
        transcript_version_hash: transcriptVersionHash || null,
        cite_timestamps: citeTimestamps || false,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating output:', error)
      return NextResponse.json({ error: 'Failed to create output' }, { status: 500 })
    }

    // Get session filename
    const { data: session } = await supabase
      .from('sessions')
      .select('internal_case_id')
      .eq('id', sessionId)
      .single()

    // Transform to v0 format
    const formattedOutput: Output = {
      id: output.id,
      sessionId: output.session_id,
      sessionFilename: session?.internal_case_id || 'Unknown',
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
      costUsd: output.cost_usd != null ? Number(output.cost_usd) : null,
    }

    return NextResponse.json(formattedOutput, { status: 201 })
  } catch (error) {
    console.error('Unexpected error creating output:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
