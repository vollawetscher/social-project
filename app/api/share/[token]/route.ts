import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Get shared output by token (public access, no auth required)
export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    console.log('[Share] Looking up token:', params.token)
    
    // Create Supabase client with service role to bypass RLS for debugging
    const supabase = await createClient()

    // First check if output exists with this token (regardless of is_public)
    console.log('[Share] Step 1: Checking if output exists...')
    const { data: checkOutput, error: checkError } = await supabase
      .from('outputs')
      .select('id, is_public, share_token, created_by, share_expires_at')
      .eq('share_token', params.token)
      .maybeSingle()

    console.log('[Share] Check result:', {
      found: !!checkOutput,
      id: checkOutput?.id,
      isPublic: checkOutput?.is_public,
      expiresAt: checkOutput?.share_expires_at,
      error: checkError
    })

    if (!checkOutput) {
      console.error('[Share] No output found with token:', params.token)
      return NextResponse.json({ 
        error: 'Shared output not found or no longer available',
        debug: 'No output with this token exists in database'
      }, { status: 404 })
    }

    if (!checkOutput.is_public) {
      console.error('[Share] Output exists but is_public=false')
      return NextResponse.json({ 
        error: 'This output is not publicly shared',
        debug: 'Output exists but is_public is false'
      }, { status: 403 })
    }

    // Check expiration
    if (checkOutput.share_expires_at && new Date(checkOutput.share_expires_at) < new Date()) {
      console.error('[Share] Output has expired:', checkOutput.share_expires_at)
      return NextResponse.json({ 
        error: 'This share link has expired',
        debug: `Expired on ${checkOutput.share_expires_at}`
      }, { status: 410 })
    }

    console.log('[Share] Step 2: Fetching full output with relations...')
    // Fetch output with related data
    const { data: output, error } = await supabase
      .from('outputs')
      .select(`
        *,
        sessions(id, internal_case_id),
        templates(name),
        profiles!outputs_created_by_fkey(full_name, company_name)
      `)
      .eq('id', checkOutput.id)
      .single()

    if (error || !output) {
      console.error('[Share] Error fetching full output:', error)
      return NextResponse.json({ 
        error: 'Failed to load output details',
        debug: error?.message || 'Unknown error'
      }, { status: 500 })
    }

    console.log('[Share] Step 3: Output fetched successfully')

    // Increment view count (non-blocking)
    void (async () => {
      try {
        await supabase
          .from('outputs')
          .update({ view_count: (output.view_count || 0) + 1 })
          .eq('id', output.id)
        console.log(`[Share] Incremented view count for output ${output.id}`)
      } catch (err) {
        console.error('[Share] Failed to increment view count:', err)
      }
    })()

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
